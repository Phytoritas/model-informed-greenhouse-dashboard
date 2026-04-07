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
import { buildAiDashboardContext } from '../utils/aiDashboardContext';
import { getCropLabel } from '../utils/displayCopy';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type {
    AdvisorDisplayPayload,
    ModelRuntimePayload,
} from '../hooks/useSmartGrowAdvisor';

interface ChatAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenKnowledgeSearch?: () => void;
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
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {title}
            </div>
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <span
                        key={`${title}-${item}`}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
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
}: {
    display: AdvisorDisplayPayload;
    copy: Record<string, string>;
}) {
    return (
        <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {display.summary ? (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {copy.summaryTitle}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">{display.summary}</p>
                </div>
            ) : null}
            <ActionTag title={copy.nowTitle} items={display.actions_now ?? []} />
            <ActionTag title={copy.todayTitle} items={display.actions_today ?? []} />
            <ActionTag title={copy.weekTitle} items={display.actions_week ?? []} />
            {(display.risks ?? []).length > 0 ? (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {copy.risksTitle}
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {(display.risks ?? []).map((risk) => (
                            <li key={risk} className="rounded-xl bg-white px-3 py-2">
                                {risk}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {(display.monitor ?? []).length > 0 ? (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {copy.monitorTitle}
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {(display.monitor ?? []).map((item) => (
                            <li key={item} className="rounded-xl bg-white px-3 py-2">
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {typeof display.confidence === 'number' ? (
                <div className="text-[11px] font-medium text-slate-500">
                    {copy.confidenceLabel}: {Math.round(display.confidence * 100)}%
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
            title: '어시스턴트',
            placeholder: '예: 지금 CO2를 100ppm 더 올리면 어떻게 되나요?',
            noResponse: '응답이 없습니다.',
            unknownError: '알 수 없는 오류가 발생했습니다.',
            aiUnavailable: '모델 상담을 사용할 수 없습니다',
            smartGrowTitle: '스마트 제어 모드',
            smartGrowLoading: '스마트 제어 모드를 불러오는 중...',
            smartGrowUnavailable: '스마트 제어 모드를 아직 불러오지 못했습니다.',
            smartGrowBoundary:
                '현재는 병해충 후보, 양액 레시피, 임시 양액 보정 처방안을 함께 볼 수 있습니다.',
            knowledgeSearch: '지식 검색',
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
            confidenceLabel: '신뢰도',
            promptPesticide: `${cropLabel} 흰가루병 후보 농약을 요약해줘`,
            promptNutrient: `${cropLabel} 현재 단계 양액 레시피와 경계 조건을 정리해줘`,
            promptCorrection: `${cropLabel} 양액 보정 초안의 수동 검토 경계를 설명해줘`,
        }
        : {
            initialMessage: 'Hello. I can explain the current greenhouse state and turn it into immediate actions.',
            title: 'Assistant',
            placeholder: 'Example: What happens if I raise CO2 by 100 ppm now?',
            noResponse: 'No response.',
            unknownError: 'An unknown error occurred.',
            aiUnavailable: 'AI chat is unavailable',
            smartGrowTitle: 'SmartGrow deterministic status',
            smartGrowLoading: 'Loading deterministic status...',
            smartGrowUnavailable: 'Deterministic status is unavailable.',
            smartGrowBoundary:
                'You can reference pesticide lookup, nutrient recipes, and the macro-only nutrient correction draft from here.',
            knowledgeSearch: 'Knowledge search',
            runtimeTitle: 'Model runtime',
            runtimeReady: 'Scenario linked',
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
            confidenceLabel: 'Confidence',
            promptPesticide: `Summarize powdery mildew pesticide candidates for ${cropLabel}`,
            promptNutrient: `Summarize the current nutrient recipe and guardrails for ${cropLabel}`,
            promptCorrection: `Explain the manual-review boundary of the nutrient correction draft for ${cropLabel}`,
        };

    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'ai', text: copy.initialMessage },
    ]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);

    const smartGrowBoundary =
        smartGrowSummary?.nutrientCorrectionLimitation ?? copy.smartGrowBoundary;
    const smartGrowPrompts = !smartGrowLoading && !smartGrowError && smartGrowSummary
        ? [
            smartGrowSummary.pesticideReady ? copy.promptPesticide : null,
            smartGrowSummary.nutrientReady ? copy.promptNutrient : null,
            smartGrowSummary.nutrientCorrectionReady ? copy.promptCorrection : null,
        ].filter((value): value is string => Boolean(value))
        : [];

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
            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
            : runtime.status === 'unavailable'
                ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-white'
                : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white';
        const badgeClasses = runtime.status === 'ready'
            ? 'bg-emerald-100 text-emerald-700'
            : runtime.status === 'unavailable'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-amber-100 text-amber-700';

        return (
            <div className={`mt-3 rounded-2xl border px-3 py-3 shadow-sm ${toneClasses}`}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {copy.runtimeTitle}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                            {runtime.summary}
                        </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeClasses}`}>
                        {statusLabel}
                    </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                    <div className="rounded-xl border border-white/80 bg-white/80 px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{copy.runtimeLai}</div>
                        <div className="mt-1 font-semibold text-slate-900">{formatRuntimeValue(state.lai, 2)}</div>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/80 px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{copy.runtimeBalance}</div>
                        <div className="mt-1 font-semibold text-slate-900">
                            {formatRuntimeValue(state.source_sink_balance, 2)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/80 px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{copy.runtimeCanopyA}</div>
                        <div className="mt-1 font-semibold text-slate-900">
                            {formatRuntimeValue(state.canopy_net_assimilation_umol_m2_s, 1, ' µmol')}
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/80 px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{copy.runtimeLimiting}</div>
                        <div className="mt-1 font-semibold text-slate-900">{state.limiting_factor ?? '-'}</div>
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {recommendedAction ? (
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            {copy.runtimeRecommended}: {recommendedAction}
                        </span>
                    ) : null}
                    {topLevers.map((lever) => {
                        const controlKey = String(lever.control ?? '');
                        const label = CONTROL_LABELS[controlKey as keyof typeof CONTROL_LABELS]?.[locale] ?? controlKey;
                        return (
                            <span
                                key={`${controlKey}-${lever.direction}`}
                                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700"
                            >
                                {copy.runtimeLevers}: {label} · {localizeDirection(lever.direction, locale)}
                            </span>
                        );
                    })}
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700">
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
            setMessages((prev) => [...prev, { role: 'ai', text: `${copy.aiUnavailable}: ${message}` }]);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-96 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 p-4 text-white">
                <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-emerald-300" />
                    <span className="font-medium">{copy.title}</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={copy.title}
                    className="rounded-full p-1 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                    {copy.smartGrowTitle}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                    {smartGrowLoading
                        ? copy.smartGrowLoading
                        : smartGrowError
                            ? copy.smartGrowUnavailable
                            : smartGrowBoundary}
                </p>
                {smartGrowPrompts.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {smartGrowPrompts.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => setInput(prompt)}
                                className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                ) : null}
                {onOpenKnowledgeSearch ? (
                    <button
                        type="button"
                        onClick={onOpenKnowledgeSearch}
                        className="mt-3 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                    >
                        {copy.knowledgeSearch}
                    </button>
                ) : null}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
                {messages.map((message, index) => (
                    <div
                        key={`${message.role}-${index}-${message.text.slice(0, 24)}`}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[84%] rounded-3xl p-3 text-sm ${
                                message.role === 'user'
                                    ? 'rounded-br-none bg-emerald-600 text-white'
                                    : 'rounded-bl-none border border-slate-200 bg-white text-slate-700'
                            }`}
                        >
                            {message.role === 'ai' ? (
                                <>
                                    {message.display ? (
                                        <StructuredReply display={message.display} copy={copy} />
                                    ) : null}
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h2: ({ ...props }) => <h2 className="mb-1 mt-2 text-sm font-semibold text-slate-900" {...props} />,
                                            h3: ({ ...props }) => <h3 className="mb-1 mt-2 text-xs font-semibold text-slate-900" {...props} />,
                                            p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                            ul: ({ ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />,
                                            ol: ({ ...props }) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />,
                                            li: ({ ...props }) => <li className="mb-0" {...props} />,
                                            strong: ({ ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
                                            code: ({ ...props }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-900" {...props} />,
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

            <div className="flex gap-2 border-t border-slate-100 bg-white p-4">
                <input
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && !isSending && handleSend()}
                    placeholder={copy.placeholder}
                    className="flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending}
                    aria-label={copy.title}
                    className="rounded-full bg-emerald-600 p-2 text-white transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50"
                >
                    <Send className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default ChatAssistant;
