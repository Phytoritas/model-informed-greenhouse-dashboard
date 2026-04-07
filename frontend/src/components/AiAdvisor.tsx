import { Sparkles, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocale } from '../i18n/LocaleProvider';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { ModelRuntimePayload } from '../hooks/useSmartGrowAdvisor';
import AdvisorConfidenceBadge from './advisor/AdvisorConfidenceBadge';

interface AiAdvisorProps {
    analysis: string;
    modelRuntime?: ModelRuntimePayload | null;
    isLoading: boolean;
    onRefresh: () => void;
    onOpenDetails?: () => void;
    onOpenKnowledgeSearch?: () => void;
    smartGrowSummary?: SmartGrowKnowledgeSummary | null;
    smartGrowLoading?: boolean;
    smartGrowError?: string | null;
}

type MarkdownSection = {
    title: string;
    body: string;
};

const CONTROL_LABELS = {
    co2_setpoint_day: { ko: '주간 CO2', en: 'Day CO2' },
    temperature_day: { ko: '주간 온도', en: 'Day temperature' },
    temperature_night: { ko: '야간 온도', en: 'Night temperature' },
    rh_target: { ko: 'RH target', en: 'RH target' },
    screen_close: { ko: '스크린 폐쇄', en: 'Screen close' },
} as const;

function extractMarkdownSections(markdown: string): MarkdownSection[] {
    const text = (markdown || '').replace(/\r\n/g, '\n');
    const normalized = text.trim();
    if (!normalized) {
        return [];
    }

    const headingMatches = [...normalized.matchAll(/^##\s+(.+)$/gm)];
    if (headingMatches.length === 0) {
        return [{ title: 'Advisor', body: normalized }];
    }

    return headingMatches.map((match, index) => {
        const title = (match[1] || 'Advisor').trim();
        const start = match.index ?? 0;
        const bodyStart = start + match[0].length;
        const nextStart = headingMatches[index + 1]?.index ?? normalized.length;
        const body = normalized.slice(bodyStart, nextStart).trim();

        return {
            title,
            body,
        };
    }).filter((section) => section.body);
}

function formatRuntimeValue(
    value: number | null | undefined,
    digits = 1,
    unit = '',
): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '-';
    }
    return `${value.toFixed(digits)}${unit}`;
}

const AiAdvisor = ({
    analysis,
    modelRuntime = null,
    isLoading,
    onRefresh,
    onOpenDetails,
    onOpenKnowledgeSearch,
    smartGrowSummary = null,
    smartGrowLoading = false,
    smartGrowError = null,
}: AiAdvisorProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            title: 'AI 어드바이저',
            loading: '데이터를 분석하는 중...',
            empty: '시스템을 초기화하고 있습니다. 충분한 데이터가 쌓이면 인사이트를 생성합니다...',
            advisoryTitle: 'SmartGrow Advisory',
            advisoryLoading: '결정형 advisory 상태를 불러오는 중...',
            advisoryUnavailable: 'advisory 상태를 불러오지 못했습니다.',
            pesticideReady: '농약 후보',
            nutrientReady: '양액 레시피',
            correctionReady: '양액 보정 draft',
            correctionBoundary:
                '현재 양액 보정은 macro-only 단일 비료 draft까지만 노출되며, 최종 stock-tank 계산은 여전히 수동 검토가 필요합니다.',
            parserPending: 'PDF parser는 아직 준비 중입니다.',
            openDetails: '자세히 보기',
            openKnowledgeSearch: '지식 검색',
            runtimeTitle: 'Model-first runtime',
            runtimeReady: 'scenario linked',
            runtimeFallback: 'monitoring-first',
            runtimeUnavailable: 'runtime unavailable',
            runtimeObserved: '관측 신호',
            runtimeLai: 'LAI',
            runtimeBalance: 'source/sink',
            runtimeCanopyA: 'canopy A',
            runtimeLimiting: '병목',
            runtimeRecommended: '지금 권장',
            runtimeLevers: '레버',
        }
        : {
            title: 'AI Advisor',
            loading: 'Analyzing data...',
            empty: 'System initializing. Waiting for sufficient data to generate insights...',
            advisoryTitle: 'SmartGrow Advisory',
            advisoryLoading: 'Loading deterministic advisory status...',
            advisoryUnavailable: 'Advisory status is unavailable.',
            pesticideReady: 'Pesticide lookup',
            nutrientReady: 'Nutrient recipe',
            correctionReady: 'Correction draft',
            correctionBoundary:
                'Nutrient correction currently exposes macro-only single-fertilizer drafts, while the final stock-tank calculation still requires manual review.',
            parserPending: 'PDF parsing is still pending.',
            openDetails: 'Open details',
            openKnowledgeSearch: 'Open knowledge search',
            runtimeTitle: 'Model-first runtime',
            runtimeReady: 'scenario linked',
            runtimeFallback: 'monitoring-first',
            runtimeUnavailable: 'runtime unavailable',
            runtimeObserved: 'Observed signal',
            runtimeLai: 'LAI',
            runtimeBalance: 'Source/sink',
            runtimeCanopyA: 'Canopy A',
            runtimeLimiting: 'Bottleneck',
            runtimeRecommended: 'Recommended now',
            runtimeLevers: 'Levers',
        };
    const sections = extractMarkdownSections(analysis);
    const correctionBoundary =
        smartGrowSummary?.nutrientCorrectionLimitation ?? copy.correctionBoundary;
    const advisoryBadges = smartGrowSummary
        ? [
            smartGrowSummary.pesticideReady ? copy.pesticideReady : null,
            smartGrowSummary.nutrientReady ? copy.nutrientReady : null,
            smartGrowSummary.nutrientCorrectionReady ? copy.correctionReady : null,
        ].filter((value): value is string => Boolean(value))
        : [];
    const runtimeState = modelRuntime?.state_snapshot ?? {};
    const runtimeTopLevers = modelRuntime?.sensitivity?.top_levers?.slice(0, 2) ?? [];
    const runtimeRecommended =
        modelRuntime?.scenario?.recommended?.action
        ?? modelRuntime?.recommendations?.[0]?.action
        ?? null;
    const runtimeObserved =
        typeof runtimeState.observed_signal_score === 'number'
            ? Math.round(runtimeState.observed_signal_score * 100)
            : null;
    const runtimeStatusTone =
        modelRuntime?.status === 'ready'
            ? 'success'
            : modelRuntime?.status === 'unavailable'
                ? 'danger'
                : 'warning';
    const runtimeStatusLabel = !modelRuntime
        ? null
        : modelRuntime.status === 'ready'
            ? copy.runtimeReady
            : modelRuntime.status === 'unavailable'
                ? copy.runtimeUnavailable
                : copy.runtimeFallback;
    return (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                    <h3 className="font-semibold">{copy.title}</h3>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className={`p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors ${isLoading ? 'animate-spin' : ''}`}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
            <div className="mb-4 max-h-[280px] overflow-y-auto rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-100">
                    {copy.advisoryTitle}
                </div>
                {smartGrowLoading ? (
                    <p className="mt-2 text-xs text-indigo-100">{copy.advisoryLoading}</p>
                ) : smartGrowError ? (
                    <p className="mt-2 text-xs text-rose-100">{copy.advisoryUnavailable}</p>
                ) : smartGrowSummary ? (
                    <>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {advisoryBadges.map((badge) => (
                                <span
                                    key={badge}
                                    className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white"
                                >
                                    {badge}
                                </span>
                            ))}
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-indigo-50">
                            {correctionBoundary}
                        </p>
                        {smartGrowSummary.pendingParsers.includes('pdf') ? (
                            <p className="mt-2 text-[11px] text-indigo-200">{copy.parserPending}</p>
                        ) : null}
                        {onOpenDetails || onOpenKnowledgeSearch ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {onOpenDetails ? (
                                    <button
                                        type="button"
                                        onClick={onOpenDetails}
                                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-white/20"
                                    >
                                        {copy.openDetails}
                                    </button>
                                ) : null}
                                {onOpenKnowledgeSearch ? (
                                    <button
                                        type="button"
                                        onClick={onOpenKnowledgeSearch}
                                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-white/20"
                                    >
                                        {copy.openKnowledgeSearch}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </>
                ) : null}
                {modelRuntime ? (
                    <section className="mt-4 rounded-xl border border-white/15 bg-slate-950/20 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-100">
                                    {copy.runtimeTitle}
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-indigo-50">
                                    {modelRuntime.summary}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {runtimeStatusLabel ? (
                                    <AdvisorConfidenceBadge
                                        label={runtimeStatusLabel}
                                        tone={runtimeStatusTone}
                                    />
                                ) : null}
                                {runtimeObserved !== null ? (
                                    <AdvisorConfidenceBadge
                                        label={`${copy.runtimeObserved} ${runtimeObserved}%`}
                                        tone="info"
                                    />
                                ) : null}
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-100">
                                    {copy.runtimeLai}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {formatRuntimeValue(runtimeState.lai, 2)}
                                </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-100">
                                    {copy.runtimeBalance}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {formatRuntimeValue(runtimeState.source_sink_balance, 2)}
                                </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-100">
                                    {copy.runtimeCanopyA}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {formatRuntimeValue(
                                        runtimeState.canopy_net_assimilation_umol_m2_s,
                                        1,
                                        ' µmol',
                                    )}
                                </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-100">
                                    {copy.runtimeLimiting}
                                </div>
                                <div className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-white">
                                    {runtimeState.limiting_factor ?? '-'}
                                </div>
                            </div>
                        </div>
                        {runtimeRecommended || runtimeTopLevers.length > 0 ? (
                            <div className="mt-3 space-y-2">
                                {runtimeRecommended ? (
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-100">
                                            {copy.runtimeRecommended}
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-white">
                                            {runtimeRecommended}
                                        </div>
                                    </div>
                                ) : null}
                                {runtimeTopLevers.length > 0 ? (
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-100">
                                            {copy.runtimeLevers}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {runtimeTopLevers.map((lever) => {
                                                const controlKey = String(lever.control ?? '');
                                                const localizedControl =
                                                    CONTROL_LABELS[controlKey as keyof typeof CONTROL_LABELS];
                                                const direction = String(lever.direction ?? '').trim();
                                                return (
                                                    <span
                                                        key={`${controlKey}-${direction}`}
                                                        className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white"
                                                    >
                                                        {localizedControl
                                                            ? localizedControl[locale]
                                                            : controlKey || '-'}
                                                        {direction ? ` · ${direction}` : ''}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </section>
                ) : null}
            </div>
            <div className="min-h-0 flex-1 bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-sm text-indigo-200">{copy.loading}</span>
                    </div>
                ) : (
                    <div className="flex h-full flex-col overflow-y-auto pr-1 text-sm leading-relaxed text-indigo-50">
                        {sections.length > 0 ? (
                            <>
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {sections.map((section) => (
                                        <span
                                            key={section.title}
                                            className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-indigo-100"
                                        >
                                            {section.title}
                                        </span>
                                    ))}
                                </div>
                                <div className="space-y-3">
                                    {sections.map((section) => (
                                        <section
                                            key={section.title}
                                            className={`rounded-lg border p-3 ${
                                                section.title === 'Executive Summary'
                                                    ? 'border-indigo-200/30 bg-white/10'
                                                    : 'border-white/10 bg-slate-900/20'
                                            }`}
                                        >
                                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-100">
                                                {section.title}
                                            </h4>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h2: ({ ...props }) => <h2 className="text-sm font-semibold mt-2 mb-1 text-white" {...props} />,
                                                    h3: ({ ...props }) => <h3 className="text-xs font-semibold mt-2 mb-1 text-white/90" {...props} />,
                                                    p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                    ul: ({ ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                                                    ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                                                    li: ({ ...props }) => <li className="mb-0" {...props} />,
                                                    strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                                                    code: ({ ...props }) => <code className="px-1 py-0.5 rounded bg-white/10 text-white" {...props} />,
                                                }}
                                            >
                                                {section.body}
                                            </ReactMarkdown>
                                        </section>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-indigo-100">{copy.empty}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiAdvisor;
