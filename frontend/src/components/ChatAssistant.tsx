import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { BookOpen, Leaf, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
};

type ChatMessage = {
    role: 'user' | 'ai';
    text: string;
};

function MarkdownAnswer({ text }: { text: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h2: ({ ...props }) => <h2 className="mb-1 mt-2 text-sm font-semibold text-[color:var(--sg-text-strong)]" {...props} />,
                h3: ({ ...props }) => <h3 className="mb-1 mt-2 text-xs font-semibold text-[color:var(--sg-text-strong)]" {...props} />,
                p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                ul: ({ ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />,
                ol: ({ ...props }) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />,
                li: ({ ...props }) => <li className="mb-0" {...props} />,
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
            initialMessage: '안녕하세요. 현재 상태를 해석하고 지금 해야 할 조치를 함께 정리해드리겠습니다.',
            title: '질문 도우미',
            close: '질문 도우미 닫기',
            send: '질문 보내기',
            placeholder: '예: 지금 CO2를 100ppm 더 올리면 어떻게 되나요?',
            noResponse: '응답이 없습니다.',
            unknownError: '알 수 없는 오류가 발생했습니다.',
            aiUnavailable: '모델 상담을 사용할 수 없습니다',
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
            unknownError: 'An unknown error occurred.',
            aiUnavailable: 'AI chat is unavailable',
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

    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'ai', text: copy.initialMessage },
    ]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const processedQueryNonceRef = useRef<number | null>(null);
    const lastPrimeSignatureRef = useRef<string>('');

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

    const sendMessage = async (rawMessage: string) => {
        const userMsg = rawMessage.trim();
        if (!userMsg) return;
        setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
        setIsSending(true);

        try {
            const cropKey = crop.toLowerCase();
            const reqMessages = [
                ...messages.map((message) => ({
                    role: message.role === 'ai' ? 'assistant' : 'user',
                    content: message.text,
                })),
                { role: 'user', content: userMsg },
            ];

            const res = await fetch(`${API_URL}/advisor/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                }),
            });
            const raw = await res.text();
            let json: ChatResponse | null = null;
            try {
                json = raw ? JSON.parse(raw) as ChatResponse : null;
            } catch {
                json = null;
            }

            if (!res.ok) {
                const message = json?.detail ?? json?.message ?? raw ?? `HTTP ${res.status}`;
                throw new Error(message);
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: 'ai',
                    text: json?.text || copy.noResponse,
                },
            ]);
        } catch (error) {
            const message = error instanceof Error ? error.message : copy.unknownError;
            setMessages((prev) => [
                ...prev,
                { role: 'ai', text: `${copy.aiUnavailable}: ${message}` },
            ]);
        } finally {
            setIsSending(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const pending = input;
        setInput('');
        await sendMessage(pending);
    };

    const sendInitialUserQuery = useEffectEvent((query: string) => {
        void sendMessage(query);
    });

    useEffect(() => {
        if (!initialUserQuery?.query?.trim()) {
            return;
        }
        if (processedQueryNonceRef.current === initialUserQuery.nonce) {
            return;
        }
        if (isSending) {
            return;
        }
        processedQueryNonceRef.current = initialUserQuery.nonce;
        sendInitialUserQuery(initialUserQuery.query);
    }, [initialUserQuery, isSending]);

    // When the chat is visible, warm the backend model-runtime emulation cache
    // for the current dashboard state (same dashboard payload as a real question,
    // so it shares the exact state fingerprint). This makes the first question
    // answer instantly. Best-effort and debounced; deduped per state.
    useEffect(() => {
        if (!isInline && !isOpen) {
            return;
        }
        const signature = `${crop}:${currentData?.timestamp ?? ''}`;
        if (lastPrimeSignatureRef.current === signature) {
            return;
        }
        const timer = setTimeout(() => {
            lastPrimeSignatureRef.current = signature;
            void fetch(`${API_URL}/advisor/chat/prime`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crop: crop.toLowerCase(),
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
                }),
            }).catch(() => {
                // Warm-up is best-effort; ignore failures.
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [
        isInline,
        isOpen,
        crop,
        currentData,
        metrics,
        history,
        forecast,
        producePrices,
        weather,
        rtrProfile,
        locale,
    ]);

    if (!isInline && !isOpen) {
        return null;
    }

    return (
        <div
            className={
                isInline
                    ? 'flex h-[560px] w-full flex-col overflow-hidden rounded-[24px]'
                    : 'fixed bottom-6 right-6 z-50 flex h-[560px] w-[28rem] flex-col overflow-hidden rounded-[32px]'
            }
            style={{
                background: 'linear-gradient(160deg, rgba(255,251,246,0.99), rgba(244,231,223,0.96) 60%, rgba(233,215,204,0.94))',
                boxShadow: 'var(--sg-shadow-soft)',
            }}
        >
            <div className="flex items-center justify-between border-b border-[color:var(--sg-outline-soft)] bg-white/60 p-4 text-[color:var(--sg-text-strong)] backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-white/88 p-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        <Leaf className="h-5 w-5 text-[color:var(--sg-color-olive)]" />
                    </div>
                    <span className="font-medium">{copy.title}</span>
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

            <div className="border-b border-[color:var(--sg-outline-soft)] px-4 py-2 sg-tint-amber">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-color-olive)]">
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        {copy.smartGrowTitle}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--sg-text-muted)]">
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
                            className="shrink-0 rounded-full bg-[color:var(--sg-color-primary)] px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[color:var(--sg-color-terracotta)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-color-primary)]"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
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
                                className="rounded-full bg-white/92 px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--sg-text-strong)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-color-primary)]"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            <div
                className={
                    isInline
                        ? 'flex-1 space-y-4 overflow-y-auto bg-[color:var(--sg-surface)] p-4 sm:p-5'
                        : 'flex-1 space-y-4 overflow-y-auto bg-[color:var(--sg-surface)] p-4'
                }
            >
                {messages.map((message, index) => (
                    <div
                        key={`${message.role}-${index}-${message.text.slice(0, 24)}`}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[84%] rounded-3xl p-3 text-sm ${
                                message.role === 'user'
                                    ? 'rounded-br-none bg-[color:var(--sg-color-olive)] text-white'
                                    : 'rounded-bl-none bg-white/94 text-[color:var(--sg-text)]'
                            }`}
                            style={message.role === 'user' ? undefined : { boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            {message.role === 'ai' ? (
                                <MarkdownAnswer text={message.text} />
                            ) : (
                                message.text
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-2 border-t border-[color:var(--sg-outline-soft)] bg-white/72 p-4">
                <input
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && !isSending && handleSend()}
                    placeholder={copy.placeholder}
                    className="flex-1 rounded-full bg-[color:var(--sg-surface-muted)] px-4 py-2 text-sm text-[color:var(--sg-text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--sg-color-primary)]"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending}
                    aria-label={copy.send}
                    className="rounded-full bg-[color:var(--sg-color-primary)] p-2 text-white transition-colors hover:bg-[color:var(--sg-color-terracotta)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-color-primary)] disabled:opacity-50"
                >
                    <Send className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default ChatAssistant;
