import { useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
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
import { getReadinessDescriptor } from '../lib/design/readiness';
import { buildAiDashboardContext } from '../utils/aiDashboardContext';
import { getCropLabel } from '../utils/displayCopy';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type {
    AdvisorDisplayPayload,
    ModelRuntimePayload,
} from '../hooks/useSmartGrowAdvisor';
import type { RagAssistantOpenRequest } from './chat/RagAssistantDrawer';

interface ChatAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenKnowledgeSearch?: (
        request?: Omit<RagAssistantOpenRequest, 'nonce'>,
    ) => void;
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
    machine_payload?: {
        display?: AdvisorDisplayPayload | null;
        model_runtime?: ModelRuntimePayload | null;
    };
};

type ChatMessage = {
    role: 'user' | 'ai';
    text: string;
    display?: AdvisorDisplayPayload | null;
    modelRuntime?: ModelRuntimePayload | null;
};

const CONTROL_LABELS = {
    co2_setpoint_day: { ko: '주간 CO2', en: 'Day CO2' },
    temperature_day: { ko: '주간 온도', en: 'Day temperature' },
    temperature_night: { ko: '야간 온도', en: 'Night temperature' },
    rh_target: { ko: '습도 목표', en: 'RH target' },
    screen_close: { ko: '스크린 개폐', en: 'Screen close' },
} as const;

function formatRuntimeValue(
    value: number | null | undefined,
    digits = 1,
    unit = '',
) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '-';
    }
    return `${value.toFixed(digits)}${unit}`;
}

function localizeDirection(direction: string | null | undefined, locale: 'ko' | 'en'): string {
    if (direction === 'increase') {
        return locale === 'ko' ? '올리기' : 'Increase';
    }
    if (direction === 'decrease') {
        return locale === 'ko' ? '내리기' : 'Decrease';
    }
    return locale === 'ko' ? '유지' : 'Hold';
}

function ActionTag({
    title,
    items,
}: {
    title: string;
    items: string[];
}) {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                {title}
            </div>
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <span
                        key={`${title}-${item}`}
                        className="rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-medium text-[color:var(--sg-text-strong)]"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

function StructuredReply({
    display,
    copy,
    locale,
}: {
    display: AdvisorDisplayPayload;
    copy: Record<string, string>;
    locale: 'ko' | 'en';
}) {
    const readiness = getReadinessDescriptor(display.confidence, locale);

    return (
        <div
            className="mt-3 space-y-3 rounded-[24px] bg-[color:var(--sg-surface-muted)] p-3"
            style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
            {display.summary ? (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                        {copy.summaryTitle}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[color:var(--sg-text-strong)]">{display.summary}</p>
                </div>
            ) : null}
            <ActionTag title={copy.nowTitle} items={display.actions_now ?? []} />
            <ActionTag title={copy.todayTitle} items={display.actions_today ?? []} />
            <ActionTag title={copy.weekTitle} items={display.actions_week ?? []} />
            {(display.risks ?? []).length > 0 ? (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                        {copy.risksTitle}
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-[color:var(--sg-text-strong)]">
                        {(display.risks ?? []).map((risk) => (
                            <li key={risk} className="rounded-[18px] bg-white/86 px-3 py-2">
                                {risk}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {(display.monitor ?? []).length > 0 ? (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                        {copy.monitorTitle}
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-[color:var(--sg-text-strong)]">
                        {(display.monitor ?? []).map((item) => (
                            <li key={item} className="rounded-[18px] bg-white/86 px-3 py-2">
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {typeof display.confidence === 'number' ? (
                <div className="text-[11px] font-medium text-[color:var(--sg-text-faint)]">
                    {readiness.lead}: {readiness.label}
                </div>
            ) : null}
        </div>
    );
}

const ChatAssistant = ({
    isOpen,
    onClose,
    onOpenKnowledgeSearch,
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
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            initialMessage: '안녕하세요. 현재 상태를 해석하고 지금 해야 할 조치를 함께 정리해드리겠습니다.',
            title: '질문하기',
            placeholder: '예: 지금 CO2를 100ppm 더 올리면 어떻게 되나요?',
            noResponse: '응답이 없습니다.',
            unknownError: '알 수 없는 오류가 발생했습니다.',
            aiUnavailable: '모델 상담을 사용할 수 없습니다',
            smartGrowTitle: '바로 열 수 있는 도구',
            smartGrowLoading: '바로 쓸 수 있는 도구 상태를 불러오는 중...',
            smartGrowUnavailable: '도구 상태를 아직 불러오지 못했습니다.',
            smartGrowHint: '연결된 화면을 열거나 추천 질문으로 바로 이어서 확인할 수 있습니다.',
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
            summaryTitle: '한줄 요약',
            risksTitle: '주의할 점',
            monitorTitle: '모니터링',
            nowTitle: '지금',
            todayTitle: '오늘',
            weekTitle: '이번 주',
            confidenceLabel: '반영 상태',
            promptPesticide: `${cropLabel} 흰가루병 후보 농약을 요약해줘`,
            promptNutrient: `${cropLabel} 현재 단계 양액 레시피와 경계 조건을 정리해줘`,
            promptCorrection: `${cropLabel} 양액 보정 초안의 수동 검토 경계를 설명해줘`,
        }
        : {
            initialMessage: 'Hello. I can explain the current greenhouse state and turn it into immediate actions.',
            title: 'Ask',
            placeholder: 'Example: What happens if I raise CO2 by 100 ppm now?',
            noResponse: 'No response.',
            unknownError: 'An unknown error occurred.',
            aiUnavailable: 'AI chat is unavailable',
            smartGrowTitle: 'Ready-to-open tools',
            smartGrowLoading: 'Loading the ready-to-open tool state...',
            smartGrowUnavailable: 'Tool status is unavailable.',
            smartGrowHint: 'Open connected screens or continue with the suggested next questions.',
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
            summaryTitle: 'Summary',
            risksTitle: 'Risks',
            monitorTitle: 'Monitor',
            nowTitle: 'Now',
            todayTitle: 'Today',
            weekTitle: 'This week',
            confidenceLabel: 'Readiness',
            promptPesticide: `Summarize powdery mildew pesticide candidates for ${cropLabel}`,
            promptNutrient: `Summarize the current nutrient recipe and guardrails for ${cropLabel}`,
            promptCorrection: `Explain the manual-review boundary of the nutrient correction draft for ${cropLabel}`,
        };

    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'ai', text: copy.initialMessage },
    ]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);

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

    const renderRuntimeStrip = (runtime: ModelRuntimePayload) => {
        const state = runtime.state_snapshot ?? {};
        const topLevers = (runtime.sensitivity?.top_levers ?? []).slice(0, 2);
        const recommendedAction =
            runtime.scenario?.recommended?.action
            ?? runtime.recommendations?.[0]?.action
            ?? null;
        const violations = runtime.constraint_checks?.violated_constraints ?? [];
        const statusLabel = runtime.status === 'ready'
            ? copy.runtimeReady
            : runtime.status === 'unavailable'
                ? copy.runtimeUnavailable
                : copy.runtimeFallback;
        const toneClasses = runtime.status === 'ready'
            ? 'sg-tint-green'
            : runtime.status === 'unavailable'
                ? 'sg-tint-violet'
                : 'sg-tint-amber';
        const badgeClasses = runtime.status === 'ready'
            ? 'bg-white/92 text-[color:var(--sg-accent-success)]'
            : runtime.status === 'unavailable'
                ? 'bg-white/92 text-[color:var(--sg-accent-danger)]'
                : 'bg-white/92 text-[color:var(--sg-accent-amber)]';

        return (
            <div className={`mt-3 rounded-[24px] px-3 py-3 ${toneClasses}`} style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                            {copy.runtimeTitle}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[color:var(--sg-text-muted)]">
                            {runtime.summary}
                        </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeClasses}`}>
                        {statusLabel}
                    </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[color:var(--sg-text-muted)]">
                    <div className="rounded-[18px] bg-white/86 px-2.5 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">{copy.runtimeLai}</div>
                        <div className="mt-1 font-semibold text-[color:var(--sg-text-strong)]">{formatRuntimeValue(state.lai, 2)}</div>
                    </div>
                    <div className="rounded-[18px] bg-white/86 px-2.5 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">{copy.runtimeBalance}</div>
                        <div className="mt-1 font-semibold text-[color:var(--sg-text-strong)]">
                            {formatRuntimeValue(state.source_sink_balance, 2)}
                        </div>
                    </div>
                    <div className="rounded-[18px] bg-white/86 px-2.5 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">{copy.runtimeCanopyA}</div>
                        <div className="mt-1 font-semibold text-[color:var(--sg-text-strong)]">
                            {formatRuntimeValue(state.canopy_net_assimilation_umol_m2_s, 1, ' µmol')}
                        </div>
                    </div>
                    <div className="rounded-[18px] bg-white/86 px-2.5 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">{copy.runtimeLimiting}</div>
                        <div className="mt-1 font-semibold text-[color:var(--sg-text-strong)]">{state.limiting_factor ?? '-'}</div>
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {recommendedAction ? (
                        <span className="rounded-full bg-[color:var(--sg-accent-violet)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            {copy.runtimeRecommended}: {recommendedAction}
                        </span>
                    ) : null}
                    {topLevers.map((lever) => {
                        const controlKey = String(lever.control ?? '');
                        const label = CONTROL_LABELS[controlKey as keyof typeof CONTROL_LABELS]?.[locale] ?? controlKey;
                        return (
                            <span
                                key={`${controlKey}-${lever.direction}`}
                                className="rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-medium text-[color:var(--sg-text-strong)]"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                {copy.runtimeLevers}: {label} · {localizeDirection(lever.direction, locale)}
                            </span>
                        );
                    })}
                    <span className="rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-medium text-[color:var(--sg-text-strong)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        {copy.runtimeConstraints}: {violations.length ? violations.length : copy.runtimeNoConstraints}
                    </span>
                </div>
            </div>
        );
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
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
                    display: json?.machine_payload?.display ?? null,
                    modelRuntime: json?.machine_payload?.model_runtime,
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

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[28rem] flex-col overflow-hidden rounded-[32px]"
            style={{
                background: 'linear-gradient(160deg, rgba(255,251,246,0.99), rgba(244,231,223,0.96) 60%, rgba(233,215,204,0.94))',
                boxShadow: 'var(--sg-shadow-soft)',
            }}
        >
            <div className="flex items-center justify-between border-b border-[color:var(--sg-outline-soft)] bg-white/60 p-4 text-[color:var(--sg-text-strong)] backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-white/88 p-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        <Bot className="h-5 w-5 text-[color:var(--sg-accent-violet)]" />
                    </div>
                    <span className="font-medium">{copy.title}</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={copy.title}
                    className="rounded-full p-1 transition-colors hover:bg-[color:var(--sg-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent-violet)]"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="border-b border-[color:var(--sg-outline-soft)] px-4 py-3 sg-tint-amber">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-accent-violet)]">
                    {copy.smartGrowTitle}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[color:var(--sg-text-muted)]">
                    {smartGrowLoading
                        ? copy.smartGrowLoading
                        : smartGrowError
                            ? `${copy.smartGrowUnavailable}: ${smartGrowError}`
                            : copy.smartGrowHint}
                </p>
                {smartGrowPrompts.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {smartGrowPrompts.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => setInput(prompt)}
                                className="rounded-full bg-white/92 px-3 py-1 text-[11px] font-medium text-[color:var(--sg-text-strong)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent-violet)]"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                ) : null}
                {onOpenKnowledgeSearch ? (
                    <button
                        type="button"
                        onClick={() => onOpenKnowledgeSearch(knowledgeSearchRequest)}
                        className="mt-3 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-[color:var(--sg-text-strong)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent-violet)]"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        {copy.knowledgeSearch}
                    </button>
                ) : null}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-[color:var(--sg-surface)] p-4">
                {messages.map((message, index) => (
                    <div
                        key={`${message.role}-${index}-${message.text.slice(0, 24)}`}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[84%] rounded-3xl p-3 text-sm ${
                                message.role === 'user'
                                    ? 'rounded-br-none bg-[color:var(--sg-accent-violet)] text-white'
                                    : 'rounded-bl-none bg-white/94 text-[color:var(--sg-text)]'
                            }`}
                            style={message.role === 'user' ? undefined : { boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            {message.role === 'ai' ? (
                                <>
                                    {message.display ? (
                                        <StructuredReply display={message.display} copy={copy} locale={locale} />
                                    ) : null}
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
                                        {message.text}
                                    </ReactMarkdown>
                                    {message.modelRuntime ? renderRuntimeStrip(message.modelRuntime) : null}
                                </>
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
                    className="flex-1 rounded-full bg-[color:var(--sg-surface-muted)] px-4 py-2 text-sm text-[color:var(--sg-text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--sg-accent-violet)]"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending}
                    aria-label={copy.title}
                    className="rounded-full bg-[color:var(--sg-accent-violet)] p-2 text-white transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent-violet)] disabled:opacity-50"
                >
                    <Send className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default ChatAssistant;
