import { useState } from 'react';
import { X, Send, Bot } from 'lucide-react';
import type {
    SensorData,
    AdvancedModelMetrics,
    CropType,
    ForecastData,
    RtrProfile,
    WeatherOutlook,
} from '../types';
import { API_URL } from '../config';
import { useLocale } from '../i18n/LocaleProvider';
import { buildAiDashboardContext } from '../utils/aiDashboardContext';
import { getCropLabel } from '../utils/displayCopy';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { ModelRuntimePayload } from '../hooks/useSmartGrowAdvisor';

interface ChatAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenKnowledgeSearch?: () => void;
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
    crop: CropType;
    forecast?: ForecastData | null;
    history?: SensorData[];
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
        model_runtime?: ModelRuntimePayload | null;
    };
};

type ChatMessage = {
    role: 'user' | 'ai';
    text: string;
    modelRuntime?: ModelRuntimePayload | null;
};

const CONTROL_LABELS = {
    co2_setpoint_day: { ko: '주간 CO2', en: 'Day CO2' },
    temperature_day: { ko: '주간 온도', en: 'Day temp' },
    temperature_night: { ko: '야간 온도', en: 'Night temp' },
    rh_target: { ko: '습도 목표', en: 'RH target' },
    screen_close: { ko: '스크린', en: 'Screen' },
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

const ChatAssistant = ({
    isOpen,
    onClose,
    onOpenKnowledgeSearch,
    currentData,
    metrics,
    crop,
    forecast,
    history = [],
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
            initialMessage: '안녕하세요! 온실 어시스턴트입니다. 현재 생육 상태나 제어 전략에 대해 물어보세요.',
            title: '어시스턴트',
            placeholder: '메시지를 입력하세요...',
            noResponse: '응답이 없습니다.',
            unknownError: '알 수 없는 오류가 발생했습니다.',
            aiUnavailable: 'AI 채팅을 사용할 수 없습니다',
            smartGrowTitle: 'SmartGrow 결정형 advisory',
            smartGrowLoading: 'advisory 상태를 불러오는 중...',
            smartGrowUnavailable: 'advisory 상태를 아직 불러오지 못했습니다.',
            smartGrowBoundary:
                '현재 병해충 후보, 양액 레시피, macro-only 양액 보정 draft를 그대로 참조할 수 있습니다.',
            knowledgeSearch: '지식 검색 열기',
            runtimeTitle: '모델 런타임',
            runtimeReady: 'scenario linked',
            runtimeFallback: 'monitoring-first',
            runtimeUnavailable: 'unavailable',
            runtimeRecommended: '추천',
            runtimeLevers: '레버',
            runtimeConstraints: '제약',
            runtimeNoConstraints: '위반 없음',
            runtimeLai: 'LAI',
            runtimeBalance: 'source/sink',
            runtimeCanopyA: 'canopy A',
            runtimeLimiting: '병목',
            promptPesticide: `${cropLabel} 흰가루병 후보 농약을 요약해줘`,
            promptNutrient: `${cropLabel} 현재 단계 양액 레시피와 guardrail을 정리해줘`,
            promptCorrection: `${cropLabel} 양액 보정 draft의 manual-only 경계를 설명해줘`,
        }
        : {
            initialMessage: "Hello! I'm your greenhouse assistant. Ask me anything about your crop status.",
            title: 'Assistant',
            placeholder: 'Type a message...',
            noResponse: 'No response.',
            unknownError: 'An unknown error occurred.',
            aiUnavailable: 'AI chat is unavailable',
            smartGrowTitle: 'SmartGrow deterministic advisory',
            smartGrowLoading: 'Loading advisory status...',
            smartGrowUnavailable: 'Advisory status is currently unavailable.',
            smartGrowBoundary:
                'You can reference pesticide lookup, nutrient recipes, and the macro-only nutrient correction draft directly from here.',
            knowledgeSearch: 'Open knowledge search',
            runtimeTitle: 'Model runtime',
            runtimeReady: 'scenario linked',
            runtimeFallback: 'monitoring-first',
            runtimeUnavailable: 'unavailable',
            runtimeRecommended: 'Recommended',
            runtimeLevers: 'Levers',
            runtimeConstraints: 'Constraints',
            runtimeNoConstraints: 'No violations',
            runtimeLai: 'LAI',
            runtimeBalance: 'Source/sink',
            runtimeCanopyA: 'Canopy A',
            runtimeLimiting: 'Bottleneck',
            promptPesticide: `Summarize powdery mildew pesticide candidates for ${cropLabel}`,
            promptNutrient: `Summarize the current nutrient recipe and guardrails for ${cropLabel}`,
            promptCorrection: `Explain the manual-only boundary of the nutrient correction draft for ${cropLabel}`,
        };
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'ai', text: copy.initialMessage }
    ]);
    const [input, setInput] = useState("");
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
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            {copy.runtimeLai}
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                            {formatRuntimeValue(state.lai, 2)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/80 px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            {copy.runtimeBalance}
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                            {formatRuntimeValue(state.source_sink_balance, 2)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/80 px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            {copy.runtimeCanopyA}
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                            {formatRuntimeValue(state.canopy_net_assimilation_umol_m2_s, 1, ' µmol')}
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/80 px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            {copy.runtimeLimiting}
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                            {state.limiting_factor ?? '-'}
                        </div>
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
                                {copy.runtimeLevers}: {label} {lever.direction === 'increase' ? '↑' : lever.direction === 'decrease' ? '↓' : '→'}
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
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput("");

        setIsSending(true);
        try {
            const cropKey = crop.toLowerCase();
            const reqMessages = [
                ...messages.map(m => ({
                    role: m.role === 'ai' ? 'assistant' : 'user',
                    content: m.text
                })),
                { role: 'user', content: userMsg }
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
                        weather,
                        rtrProfile,
                    }),
                    language: locale
                })
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
                    modelRuntime: json?.machine_payload?.model_runtime,
                },
            ]);
        } catch (e) {
            const message =
                e instanceof Error ? e.message : copy.unknownError;
            setMessages(prev => [...prev, { role: 'ai', text: `${copy.aiUnavailable}: ${message}` }]);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-green-400" />
                    <span className="font-medium">{copy.title}</span>
                </div>
                <button onClick={onClose} className="hover:text-slate-300"><X className="w-5 h-5" /></button>
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
                                onClick={() => setInput(prompt)}
                                className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
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
                        className="mt-3 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800 hover:bg-emerald-100"
                    >
                        {copy.knowledgeSearch}
                    </button>
                ) : null}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-green-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                            }`}>
                            {msg.role === 'ai' ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h2: ({ ...props }) => <h2 className="text-sm font-semibold mt-2 mb-1 text-slate-900" {...props} />,
                                        h3: ({ ...props }) => <h3 className="text-xs font-semibold mt-2 mb-1 text-slate-900" {...props} />,
                                        p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                        ul: ({ ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                                        ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                                        li: ({ ...props }) => <li className="mb-0" {...props} />,
                                        strong: ({ ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
                                        code: ({ ...props }) => <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-900" {...props} />,
                                    }}
                                >
                                    {msg.text}
                                </ReactMarkdown>
                            ) : (
                                msg.text
                            )}
                            {msg.role === 'ai' && msg.modelRuntime ? renderRuntimeStrip(msg.modelRuntime) : null}
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !isSending && handleSend()}
                    placeholder={copy.placeholder}
                    className="flex-1 px-4 py-2 bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
                <button
                    onClick={handleSend}
                    disabled={isSending}
                    className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default ChatAssistant;
