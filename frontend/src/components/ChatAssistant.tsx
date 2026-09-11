import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { BookOpen, Leaf, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ScientificText, { scientificChildren } from './common/ScientificText';
import type {
    AdvancedModelMetrics,
    CropType,
    ForecastData,
    ProducePricesPayload,
    RtrProfile,
    SensorData,
    WeatherOutlook,
} from '../types';
import { API_URL } from '../config';
import { useLocale } from '../i18n/LocaleProvider';
import { buildAiDashboardContext } from '../utils/aiDashboardContext';
import { getCropLabel } from '../utils/displayCopy';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { RagAssistantOpenRequest } from './chat/ragAssistantTypes';
import {
    CHAT_STREAM_ACCEPT,
    ChatStreamParseError,
    isChatStreamResponse,
    readChatStream,
    type ChatStreamPhase,
    type ChatStreamResponse,
} from './chat/chatStream';
import '../styles/assistant-workspace.css';

interface ChatAssistantProps {
    isOpen?: boolean;
    onClose?: () => void;
    layoutMode?: 'drawer' | 'inline';
    onOpenKnowledgeSearch?: (
        request?: Omit<RagAssistantOpenRequest, 'nonce'>,
    ) => void;
    initialUserQuery?: { query: string; nonce: number } | null;
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
    crop: CropType;
    forecast?: ForecastData | null;
    history?: SensorData[];
    producePrices?: ProducePricesPayload | null;
    weather?: WeatherOutlook | null;
    rtrProfile?: RtrProfile | null;
    smartGrowSummary?: SmartGrowKnowledgeSummary | null;
    smartGrowLoading?: boolean;
    smartGrowError?: string | null;
}

type ChatResponse = {
    detail?: string;
    message?: string;
    text?: string;
    status?: string;
    follow_up?: unknown;
    // Retrieval provenance stays in the payload for backend diagnostics and is
    // deliberately never rendered: the conversation shows the answer only.
    grounded_status?: string;
    sources?: ChatSource[];
};

type ChatSource = { title: string; source_locator?: string | null; document_id?: number; chunk_id?: number };
type ChatFollowUp = { question: string; options: string[] };
type ChatMessage = {
    role: 'user' | 'ai';
    text: string;
    followUp?: ChatFollowUp | null;
    /**
     * For a turn created by tapping a quick reply, the question it answers.
     * A chosen option is often a bare noun phrase ('특정 구역에 집중'), which
     * reads as a fragment without the question it belongs to.
     */
    replyTo?: string;
};

/** Wire shape for one turn; `reply_to` is present only on a chosen option. */
type ChatRequestMessage = {
    role: 'user' | 'assistant';
    content: string;
    reply_to?: string;
};

/**
 * Turns of context sent with each question. The backend rebuilds state from
 * this, so a long consultation keeps its earlier findings instead of losing
 * them a dozen turns in.
 */
const MAX_HISTORY_TURNS = 64;

/**
 * Records answer latency for internal performance work. It writes a performance
 * mark and, in development, one console entry; nothing reaches the UI, so no
 * timing jargon appears in the conversation.
 */
function recordChatTiming(sample: {
    firstTextMs: number | null;
    totalMs: number;
    streamed: boolean;
    backend: Record<string, unknown> | null;
}) {
    try {
        performance.measure?.('advisor-chat-answer', {
            start: performance.now() - sample.totalMs,
            duration: sample.totalMs,
            detail: sample,
        } as PerformanceMeasureOptions);
    } catch {
        // Measurement is diagnostic; a missing User Timing API is not an error.
    }
    if (import.meta.env?.DEV) {
        console.debug('[advisor-chat] timing', sample);
    }
}

/** Accept only a well-formed follow-up; anything else leaves the turn plain. */
function normalizeFollowUp(value: unknown): ChatFollowUp | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as { question?: unknown; options?: unknown };
    const question = typeof candidate.question === 'string' ? candidate.question.trim() : '';
    if (!question) return null;
    const options = Array.isArray(candidate.options)
        ? candidate.options
            .filter((option): option is string => typeof option === 'string')
            .map((option) => option.trim())
            .filter((option, index, list) => option.length > 0 && list.indexOf(option) === index)
            .slice(0, 3)
        : [];
    return { question, options };
}

/** A choice reply is short, so the asked question travels with the answer it belongs to. */
function historyContent(message: ChatMessage): string {
    if (message.role !== 'ai') return message.text;
    const question = message.followUp?.question?.trim();
    return question ? `${message.text}\n\n${question}` : message.text;
}

/** Serializes one stored turn, carrying `reply_to` only where it exists. */
function toRequestMessage(message: ChatMessage): ChatRequestMessage {
    const base: ChatRequestMessage = {
        role: message.role === 'ai' ? 'assistant' : 'user',
        content: historyContent(message),
    };
    const replyTo = message.role === 'user' ? message.replyTo?.trim() : '';
    return replyTo ? { ...base, reply_to: replyTo } : base;
}

function MarkdownAnswer({ text }: { text: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h2: ({ children }) => <h2 className="mb-2 mt-5 text-[17px] font-semibold leading-relaxed text-[color:var(--sg-text-strong)]">{scientificChildren(children)}</h2>,
                h3: ({ children }) => <h3 className="mb-2 mt-4 text-[15px] font-semibold leading-relaxed text-[color:var(--sg-text-strong)]">{scientificChildren(children)}</h3>,
                p: ({ children }) => <p className="mb-2 last:mb-0">{scientificChildren(children)}</p>,
                ul: ({ ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />,
                ol: ({ ...props }) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />,
                li: ({ children }) => <li className="mb-0">{scientificChildren(children)}</li>,
                th: ({ children, style }) => <th style={style}>{scientificChildren(children)}</th>,
                td: ({ children, style }) => <td style={style}>{scientificChildren(children)}</td>,
                strong: ({ ...props }) => <strong className="font-semibold text-[color:var(--sg-text-strong)]" {...props} />,
                code: ({ ...props }) => <code className="rounded bg-[color:var(--sg-surface-muted)] px-1 py-0.5 text-[color:var(--sg-text-strong)]" {...props} />,
            }}
        >
            {text}
        </ReactMarkdown>
    );
}

const ChatAssistant = ({
    isOpen = true,
    onClose,
    layoutMode = 'drawer',
    onOpenKnowledgeSearch,
    initialUserQuery = null,
    currentData,
    metrics,
    crop,
    forecast,
    history = [],
    producePrices = null,
    weather = null,
    rtrProfile = null,
    smartGrowSummary = null,
    smartGrowLoading = false,
    smartGrowError = null,
}: ChatAssistantProps) => {
    const isInline = layoutMode === 'inline';
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            initialMessage: '안녕하세요. 현재 상태를 해석하고 지금 해야 할 조치를 함께 정리해드리겠습니다. 편하게 물어보시면 됩니다.',
            title: '질문 도우미',
            close: '질문 도우미 닫기',
            send: '질문 보내기',
            placeholder: '예: 지금 CO2를 100ppm 더 올리면 어떻게 되나요?',
            noResponse: '응답이 없습니다.',
            pending: '답변을 준비하고 있습니다…',
            retrieving: '자료를 찾고 있습니다…',
            generating: '답변을 작성하고 있습니다…',
            followUpHint: '아래에서 고르거나 직접 입력해 주세요.',
            unknownError: '알 수 없는 오류가 발생했습니다.',
            aiUnavailable: '모델 상담을 사용할 수 없습니다',
            interrupted: '답변이 중간에 끊겼습니다. 다시 시도해 주세요.',
            smartGrowTitle: '현장 도구',
            smartGrowLoading: '바로 쓸 수 있는 도구 상태를 불러오는 중...',
            smartGrowUnavailable: '도구 상태를 아직 불러오지 못했습니다.',
            smartGrowHint: '필요한 자료와 실행 화면을 이어서 확인할 수 있습니다.',
            knowledgeSearch: '자료 찾기',
            runtimeTitle: '예측 모델 분석',
            runtimeReady: '예측 반영',
            runtimeFallback: '상태 해석 우선',
            runtimeUnavailable: '분석 정보 없음',
            runtimeRecommended: '추천',
            runtimeLevers: '주요 환경 요인',
            runtimeConstraints: '제약',
            runtimeNoConstraints: '위반 없음',
            runtimeLai: 'LAI',
            runtimeBalance: '공급/수요 균형',
            runtimeCanopyA: '캐노피 동화량',
            runtimeLimiting: '병목',
            runtimeEffectTitle: '모델 계산 효과',
            runtimeYieldEffect: '수량 변화',
            runtimePhysiologyEffect: '생리 반응',
            runtimeCostRiskEffect: '비용/리스크',
            runtimeConfidence: '계산 신뢰도',
            summaryTitle: '한줄 요약',
            risksTitle: '주의할 점',
            monitorTitle: '모니터링',
            nowTitle: '지금',
            todayTitle: '오늘',
            weekTitle: '이번 주',
            confidenceLabel: '반영 상태',
            farmerSummaryTitle: '농가용 요약',
            farmerActionTitle: '작업 순서',
            fullAnswerTitle: '전체 답변 보기',
            promptPesticide: `${cropLabel} 흰가루병 후보 농약을 요약해줘`,
            promptNutrient: `${cropLabel} 현재 단계 양액 레시피와 경계 조건을 정리해줘`,
            promptCorrection: `${cropLabel} 양액 보정 초안의 수동 검토 경계를 설명해줘`,
        }
        : {
            initialMessage: 'Hello. I can explain the current greenhouse state and turn it into immediate actions.',
            title: 'Question helper',
            close: 'Close question helper',
            send: 'Send question',
            placeholder: 'Example: What happens if I raise CO2 by 100 ppm now?',
            noResponse: 'No response.',
            pending: 'Working on your answer…',
            retrieving: 'Looking through the materials…',
            generating: 'Writing the answer…',
            followUpHint: 'Pick one below or just type your own.',
            unknownError: 'An unknown error occurred.',
            aiUnavailable: 'AI chat is unavailable',
            interrupted: 'The answer was cut off before it finished. Please retry.',
            smartGrowTitle: 'Field tools',
            smartGrowLoading: 'Loading the ready-to-open tool state...',
            smartGrowUnavailable: 'Tool status is unavailable.',
            smartGrowHint: 'Open the linked material or move into the connected workflow.',
            knowledgeSearch: 'Find materials',
            runtimeTitle: 'Model runtime',
            runtimeReady: 'Recommendation linked',
            runtimeFallback: 'Monitoring first',
            runtimeUnavailable: 'Runtime unavailable',
            runtimeRecommended: 'Recommended',
            runtimeLevers: 'Levers',
            runtimeConstraints: 'Constraints',
            runtimeNoConstraints: 'No violations',
            runtimeLai: 'LAI',
            runtimeBalance: 'Source/sink balance',
            runtimeCanopyA: 'Canopy assimilation',
            runtimeLimiting: 'Bottleneck',
            runtimeEffectTitle: 'Model-calculated effect',
            runtimeYieldEffect: 'Yield change',
            runtimePhysiologyEffect: 'Physiology',
            runtimeCostRiskEffect: 'Cost/risk',
            runtimeConfidence: 'Confidence',
            summaryTitle: 'Summary',
            risksTitle: 'Risks',
            monitorTitle: 'Monitor',
            nowTitle: 'Now',
            todayTitle: 'Today',
            weekTitle: 'This week',
            confidenceLabel: 'Readiness',
            farmerSummaryTitle: 'Grower summary',
            farmerActionTitle: 'Work order',
            fullAnswerTitle: 'Show full answer',
            promptPesticide: `Summarize powdery mildew pesticide candidates for ${cropLabel}`,
            promptNutrient: `Summarize the current nutrient recipe and guardrails for ${cropLabel}`,
            promptCorrection: `Explain the manual-review boundary of the nutrient correction draft for ${cropLabel}`,
        };

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    // Answer text as it arrives. Rendered as a live bubble; it becomes a real
    // message only when the authoritative 'done' payload lands.
    const [streamingText, setStreamingText] = useState('');
    const [streamPhase, setStreamPhase] = useState<ChatStreamPhase | null>(null);
    const processedQueryNonceRef = useRef<number | null>(null);
    const requestRef = useRef<AbortController | null>(null);
    const requestVersionRef = useRef(0);
    const activeCropRef = useRef(crop);
    const messageListRef = useRef<HTMLDivElement | null>(null);
    // True while the reader is parked at the newest turn. Scrolling up to re-read an
    // earlier answer clears it, so an appended turn never yanks the viewport back down.
    const stickToBottomRef = useRef(true);
    const [failure, setFailure] = useState<{ question: string; message: string; replyTo?: string } | null>(null);

    useEffect(() => {
        if (activeCropRef.current === crop) return;
        activeCropRef.current = crop;
        requestRef.current?.abort();
        requestRef.current = null;
        requestVersionRef.current += 1;
        processedQueryNonceRef.current = initialUserQuery?.nonce ?? null;
        stickToBottomRef.current = true;
        setMessages([]);
        setInput('');
        setFailure(null);
        setIsSending(false);
        setStreamingText('');
        setStreamPhase(null);
    }, [crop, initialUserQuery?.nonce]);

    // Closing the drawer ends the turn in flight: its answer belongs to a
    // conversation the reader has left.
    useEffect(() => {
        if (isOpen || isInline || !requestRef.current) return;
        requestVersionRef.current += 1;
        requestRef.current.abort();
        requestRef.current = null;
        setIsSending(false);
        setStreamingText('');
        setStreamPhase(null);
    }, [isOpen, isInline]);

    useEffect(() => () => {
        requestVersionRef.current += 1;
        requestRef.current?.abort();
    }, []);

    const handleMessageListScroll = () => {
        const list = messageListRef.current;
        if (!list) return;
        stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight <= 48;
    };

    // Follow the conversation as it grows: a new answer and its quick replies must be
    // reachable without a manual scroll. The jump is instant, so reduced-motion holds.
    useEffect(() => {
        const list = messageListRef.current;
        if (!list || !stickToBottomRef.current) return;
        list.scrollTop = list.scrollHeight;
    }, [messages, isSending, failure, streamingText]);

    const smartGrowPrompts = !smartGrowLoading && !smartGrowError && smartGrowSummary
        ? [
            smartGrowSummary.pesticideReady ? copy.promptPesticide : null,
            smartGrowSummary.nutrientReady ? copy.promptNutrient : null,
            smartGrowSummary.nutrientCorrectionReady ? copy.promptCorrection : null,
        ].filter((value): value is string => Boolean(value))
        : [];
    const knowledgeSearchRequest: Omit<RagAssistantOpenRequest, 'nonce'> = input.trim()
        ? {
            query: input.trim(),
            autoRun: true,
            source: 'assistant',
        }
        : smartGrowSummary?.nutrientCorrectionReady
            ? {
                preset: 'nutrient',
                query: copy.promptCorrection,
                autoRun: true,
                source: 'assistant',
            }
            : smartGrowSummary?.nutrientReady
                ? {
                    preset: 'nutrient',
                    query: copy.promptNutrient,
                    autoRun: true,
                    source: 'assistant',
                }
                : smartGrowSummary?.pesticideReady
                    ? {
                        preset: 'pesticide',
                        query: copy.promptPesticide,
                        autoRun: true,
                        source: 'assistant',
                    }
                    : {
                        preset: 'general',
                        query:
                            locale === 'ko'
                                ? `${cropLabel} 재배 자료를 찾아줘`
                                : `Find cultivation notes for ${cropLabel}`,
                        autoRun: true,
                        source: 'assistant',
                    };

    const sendMessage = async (rawMessage: string, retry = false, replyTo?: string) => {
        const userMsg = rawMessage.trim();
        if (!userMsg || requestRef.current) return;
        const answeredQuestion = replyTo?.trim() || undefined;
        if (!retry) {
            setMessages((prev) => [
                ...prev,
                answeredQuestion
                    ? { role: 'user', text: userMsg, replyTo: answeredQuestion }
                    : { role: 'user', text: userMsg },
            ]);
        }
        setIsSending(true);
        setFailure(null);
        setStreamingText('');
        setStreamPhase(null);
        const controller = new AbortController();
        requestRef.current = controller;
        const version = ++requestVersionRef.current;
        const timeout = setTimeout(() => controller.abort(), 90_000);
        // Internal only: how long until the reader sees text, and how long in
        // total. Never surfaced in the conversation. Boxed because the stream
        // callback assigns it.
        const startedAt = performance.now();
        const latency: { firstTextAt: number | null } = { firstTextAt: null };

        /**
         * True once this turn has been superseded, cancelled, or left behind.
         * Note this deliberately does not key on currentData: the simulated
         * clock advances every tick, so restarting on it would kill every
         * in-flight answer. No replay or dataset identity prop reaches this
         * component today, so crop remains the only reliable reset signal.
         */
        const isAbandoned = () => version !== requestVersionRef.current
            || activeCropRef.current !== crop;

        /**
         * Whether this turn may still write to the conversation. The signal is
         * checked directly because the 90 s timeout aborts without bumping the
         * version, and a mocked or slow response can keep yielding chunks after
         * that; an abandoned turn must not commit an answer either way.
         */
        const isStale = () => controller.signal.aborted || isAbandoned();

        try {
            const cropKey = crop.toLowerCase();
            const pendingTurn: ChatRequestMessage = answeredQuestion
                ? { role: 'user', content: userMsg, reply_to: answeredQuestion }
                : { role: 'user', content: userMsg };
            const reqMessages: ChatRequestMessage[] = [
                ...messages.slice(-MAX_HISTORY_TURNS).map(toRequestMessage),
                // A retry resends the stored history, which already ends with
                // this turn and its reply_to.
                ...(!retry ? [pendingTurn] : []),
            ];

            const res = await fetch(`${API_URL}/advisor/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: CHAT_STREAM_ACCEPT },
                signal: controller.signal,
                body: JSON.stringify({
                    crop: cropKey,
                    messages: reqMessages,
                    dashboard: buildAiDashboardContext({
                        currentData,
                        metrics,
                        crop,
                        history,
                        forecast,
                        producePrices,
                        weather,
                        rtrProfile,
                    }),
                    language: locale,
                    stream: true,
                }),
            });

            // Collected inside the reader callback; boxed so narrowing after the
            // await does not treat these as still-unassigned.
            const streamState: { done: ChatResponse | null; error: string | null } = {
                done: null,
                error: null,
            };

            if (res.ok && isChatStreamResponse(res)) {
                let accumulated = '';
                await readChatStream(res.body as ReadableStream<Uint8Array>, (event) => {
                    if (isStale()) return;
                    if (event.type === 'status') {
                        setStreamPhase(event.phase);
                        return;
                    }
                    if (event.type === 'delta') {
                        if (latency.firstTextAt === null) latency.firstTextAt = performance.now();
                        accumulated += event.text;
                        setStreamingText(accumulated);
                        return;
                    }
                    if (event.type === 'done') {
                        // The final payload wins: streamed text was a preview of it.
                        streamState.done = event.response as ChatResponse;
                        return;
                    }
                    streamState.error = event.message || copy.aiUnavailable;
                });
                // An abandoned turn stops here; a timeout mid-stream falls
                // through so the reader is told the answer was cut off.
                if (isAbandoned()) return;
                if (streamState.error && !streamState.done) {
                    throw new Error(streamState.error);
                }
                // A stream that ends without 'done' produced no authoritative
                // answer, so the partial text is discarded rather than shown as
                // if it were complete. Say it was cut off, not unavailable: the
                // model did answer, the connection ended early.
                if (!streamState.done) {
                    throw new Error(copy.interrupted);
                }
            } else {
                const raw = await res.text();
                try {
                    streamState.done = raw ? JSON.parse(raw) as ChatResponse : null;
                } catch {
                    streamState.done = null;
                }
            }

            const json = streamState.done;

            if (!res.ok || json?.status === 'degraded' || !json?.text?.trim()) {
                const message = json?.text ?? json?.message ?? copy.aiUnavailable;
                throw new Error(message);
            }

            if (isStale()) return;

            recordChatTiming({
                firstTextMs: latency.firstTextAt === null ? null : latency.firstTextAt - startedAt,
                totalMs: performance.now() - startedAt,
                streamed: latency.firstTextAt !== null,
                backend: (json as ChatStreamResponse | null)?.timings ?? null,
            });

            setMessages((prev) => [
                ...prev,
                {
                    role: 'ai',
                    text: json?.text || copy.noResponse,
                    followUp: normalizeFollowUp(json.follow_up),
                },
            ]);
        } catch (error) {
            // An abandoned turn stays silent, but a timeout on the conversation
            // the reader is still looking at has to be reported.
            if (isAbandoned()) return;
            const message = controller.signal.aborted
                ? (locale === 'ko' ? '답변 시간이 길어져 요청을 중단했습니다. 다시 시도해 주세요.' : 'The answer took too long. Please retry.')
                // A damaged line means text was lost, which reads to the user as
                // an interrupted answer rather than a parser fault.
                : error instanceof ChatStreamParseError ? copy.interrupted
                    : error instanceof Error ? error.message : copy.unknownError;
            setFailure({ question: userMsg, message, replyTo: answeredQuestion });
        } finally {
            clearTimeout(timeout);
            if (version === requestVersionRef.current) {
                requestRef.current = null;
                setIsSending(false);
                setStreamingText('');
                setStreamPhase(null);
            }
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const pending = input;
        setInput('');
        await sendMessage(pending);
    };

    // A quick reply is an ordinary user turn. Options stay inert unless they belong
    // to the last message, so an answered set can never fire a second request.
    const handleFollowUpOption = (option: string, question: string) => {
        if (isSending || requestRef.current) return;
        setInput('');
        // The chosen label alone can read as a bare noun phrase, so the question
        // it answers travels with it.
        void sendMessage(option, false, question);
    };

    const sendInitialUserQuery = useEffectEvent((query: string) => {
        void sendMessage(query);
    });

    useEffect(() => {
        if (!isOpen || !initialUserQuery?.query?.trim()) {
            return;
        }
        if (processedQueryNonceRef.current === initialUserQuery.nonce) {
            return;
        }
        if (isSending) {
            return;
        }
        const timer = window.setTimeout(() => {
            processedQueryNonceRef.current = initialUserQuery.nonce;
            sendInitialUserQuery(initialUserQuery.query);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [initialUserQuery, isSending, isOpen]);

    if (!isInline && !isOpen) {
        return null;
    }

    return (
        <div
            className={
                isInline
                    ? 'assistant-conversation assistant-conversation-inline'
                    : 'assistant-conversation assistant-conversation-floating'
            }
        >
            <div className="assistant-conversation-header">
                <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-[color:var(--sg-color-primary-soft)] p-2">
                        <Leaf className="h-5 w-5 text-[color:var(--sg-color-primary)]" />
                    </div>
                    <div>
                        <span className="text-[15px] font-semibold">{copy.title}</span>
                        <p className="mt-1 text-[13px] text-[color:var(--sg-text-muted)]">{cropLabel} · {locale === 'ko' ? '온실 상태와 재배 자료' : 'Greenhouse context and references'}</p>
                    </div>
                </div>
                {!isInline && onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={copy.close}
                        className="rounded-full p-1 transition-colors hover:bg-[color:var(--sg-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-color-primary)]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                ) : null}
            </div>

            <div className="assistant-conversation-tools">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--sg-text-muted)]">
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        {copy.smartGrowTitle}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-[color:var(--sg-text-muted)]">
                        {smartGrowLoading
                            ? copy.smartGrowLoading
                            : smartGrowError
                                ? `${copy.smartGrowUnavailable}: ${smartGrowError}`
                                : copy.smartGrowHint}
                    </span>
                    {onOpenKnowledgeSearch ? (
                        <button
                            type="button"
                            onClick={() => onOpenKnowledgeSearch(knowledgeSearchRequest)}
                            className="assistant-material-link"
                        >
                            {copy.knowledgeSearch}
                        </button>
                    ) : null}
                </div>
                {smartGrowPrompts.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {smartGrowPrompts.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => setInput(prompt)}
                                className="assistant-prompt"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            <div
                className="assistant-message-list"
                ref={messageListRef}
                onScroll={handleMessageListScroll}
                role="log"
                aria-label={locale === 'ko' ? '대화 내용' : 'Conversation'}
            >
                {messages.length === 0 ? (
                    <div className="assistant-empty">
                        <span className="assistant-empty-icon"><Leaf className="h-6 w-6" aria-hidden="true" /></span>
                        <h3>{locale === 'ko' ? `${cropLabel} 재배, 무엇이 궁금하세요?` : `What would you like to know about ${cropLabel.toLowerCase()}?`}</h3>
                        <p>{copy.initialMessage}</p>
                    </div>
                ) : null}
                {messages.map((message, index) => {
                    // Only the newest answer keeps live quick replies; earlier ones stay as read-only record.
                    const isLatest = index === messages.length - 1;
                    const followUp = message.role === 'ai' ? message.followUp : null;
                    return (
                        <div
                            key={`${message.role}-${index}-${message.text.slice(0, 24)}`}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`assistant-message ${message.role === 'user' ? 'assistant-message-user' : 'assistant-message-answer'}`}
                            >
                                {message.role === 'ai' ? (
                                    <>
                                        <MarkdownAnswer text={message.text} />
                                        {followUp ? (
                                            <div className="assistant-followup">
                                                <p className="assistant-followup-question">
                                                    <ScientificText text={followUp.question} />
                                                </p>
                                                {followUp.options.length > 0 && isLatest ? (
                                                    <>
                                                        <div className="assistant-followup-options">
                                                            {followUp.options.map((option) => (
                                                                <button
                                                                    key={option}
                                                                    type="button"
                                                                    disabled={isSending}
                                                                    onClick={() => handleFollowUpOption(option, followUp.question)}
                                                                    className="assistant-followup-option"
                                                                >
                                                                    <ScientificText text={option} />
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <p className="assistant-followup-hint">{copy.followUpHint}</p>
                                                    </>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </>
                                ) : (
                                    message.text
                                )}
                            </div>
                        </div>
                    );
                })}
                {/* The answer streams into a normal answer bubble. Quick replies
                    are absent here: they arrive with the final payload. */}
                {streamingText ? (
                    <div className="flex justify-start">
                        <div className="assistant-message assistant-message-answer" data-testid="assistant-streaming-message">
                            <MarkdownAnswer text={streamingText} />
                        </div>
                    </div>
                ) : null}
                {isSending && !streamingText ? (
                    <p role="status" className="text-sm text-[color:var(--sg-text-muted)]">
                        {streamPhase === 'retrieving'
                            ? copy.retrieving
                            : streamPhase === 'generating'
                                ? copy.generating
                                : copy.pending}
                    </p>
                ) : null}
                {failure ? <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                    <p>{failure.message}</p>
                    <button type="button" disabled={isSending} onClick={() => void sendMessage(failure.question, true, failure.replyTo)} className="mt-2 rounded-lg border border-red-200 px-3 py-1 font-medium">{locale === 'ko' ? '다시 시도' : 'Retry'}</button>
                </div> : null}
            </div>

            <div className="assistant-composer">
                <input
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && !isSending && handleSend()}
                    placeholder={copy.placeholder}
                    aria-label={locale === 'ko' ? '질문 입력' : 'Your question'}
                    className="assistant-composer-input"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending}
                    aria-label={copy.send}
                    className="assistant-composer-send"
                >
                    <Send className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default ChatAssistant;
