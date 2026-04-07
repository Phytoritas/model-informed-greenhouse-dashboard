import { RefreshCw, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocale } from '../i18n/LocaleProvider';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type {
    AdvisorDisplayPayload,
    ModelRuntimePayload,
} from '../hooks/useSmartGrowAdvisor';
import AdvisorConfidenceBadge from './advisor/AdvisorConfidenceBadge';

interface AiAdvisorProps {
    analysis: string;
    display?: AdvisorDisplayPayload | null;
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
    rh_target: { ko: '습도 목표', en: 'RH target' },
    screen_close: { ko: '스크린 개폐', en: 'Screen close' },
} as const;

function extractMarkdownSections(markdown: string): MarkdownSection[] {
    const text = (markdown || '').replace(/\r\n/g, '\n').trim();
    if (!text) {
        return [];
    }

    const headingMatches = [...text.matchAll(/^##\s+(.+)$/gm)];
    if (headingMatches.length === 0) {
        return [{ title: 'fallback', body: text }];
    }

    return headingMatches.map((match, index) => {
        const start = match.index ?? 0;
        const bodyStart = start + match[0].length;
        const nextStart = headingMatches[index + 1]?.index ?? text.length;
        return {
            title: (match[1] || '').trim(),
            body: text.slice(bodyStart, nextStart).trim(),
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

function localizeDirection(direction: string | null | undefined, locale: 'ko' | 'en'): string {
    if (direction === 'increase') {
        return locale === 'ko' ? '올리기' : 'Increase';
    }
    if (direction === 'decrease') {
        return locale === 'ko' ? '내리기' : 'Decrease';
    }
    return locale === 'ko' ? '유지' : 'Hold';
}

function ActionColumn({
    title,
    items,
    emptyLabel,
}: {
    title: string;
    items: string[];
    emptyLabel: string;
}) {
    return (
        <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-100">
                {title}
            </div>
            {items.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm leading-relaxed text-white">
                    {items.map((item) => (
                        <li key={item} className="rounded-xl bg-slate-950/20 px-3 py-2">
                            {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 text-xs text-indigo-100">{emptyLabel}</p>
            )}
        </div>
    );
}

const AiAdvisor = ({
    analysis,
    display = null,
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
            loading: '실시간 데이터와 모델 상태를 분석하는 중입니다...',
            empty: '데이터가 더 쌓이면 실행 가능한 조치를 먼저 보여드립니다.',
            advisoryTitle: '스마트그로우 결정형 상태',
            advisoryLoading: '결정형 상태를 불러오는 중...',
            advisoryUnavailable: '결정형 상태를 아직 불러오지 못했습니다.',
            pesticideReady: '농약 후보',
            nutrientReady: '양액 레시피',
            correctionReady: '양액 보정 초안',
            correctionBoundary:
                '현재 양액 보정은 macro-only 단일 비료 초안까지만 자동화되어 있으며, 최종 stock-tank 계산은 수동 검토가 필요합니다.',
            parserPending: 'PDF parser는 아직 준비 중입니다.',
            openDetails: '세부 탭 보기',
            openKnowledgeSearch: '지식 검색',
            runtimeTitle: '모델 런타임',
            runtimeReady: '시나리오 연동',
            runtimeFallback: '모니터링 우선',
            runtimeUnavailable: '런타임 없음',
            runtimeObserved: '관측 신호',
            runtimeLai: 'LAI',
            runtimeBalance: '공급/수요 균형',
            runtimeCanopyA: '캐노피 동화량',
            runtimeLimiting: '병목',
            runtimeRecommended: '지금 권장',
            runtimeLevers: '우선 레버',
            summaryTitle: '한줄 요약',
            risksTitle: '주의할 점',
            monitorTitle: '모니터링',
            nowTitle: '지금',
            todayTitle: '오늘',
            weekTitle: '이번 주',
            noImmediateActions: '지금 강한 조치보다 상태 확인이 우선입니다.',
            noTodayActions: '오늘 추가 조치 없이 모니터링을 유지합니다.',
            noWeekActions: '이번 주 조정안은 아직 없습니다.',
            noRisks: '즉시 표시할 위험이 없습니다.',
            noMonitor: '추가 모니터링 항목이 없습니다.',
            fallbackTitle: '상세 설명',
        }
        : {
            title: 'AI Advisor',
            loading: 'Analyzing live data and model state...',
            empty: 'Actionable guidance will appear once enough data accumulates.',
            advisoryTitle: 'SmartGrow deterministic status',
            advisoryLoading: 'Loading deterministic status...',
            advisoryUnavailable: 'Deterministic status is unavailable.',
            pesticideReady: 'Pesticide lookup',
            nutrientReady: 'Nutrient recipe',
            correctionReady: 'Correction draft',
            correctionBoundary:
                'Nutrient correction currently exposes macro-only single-fertilizer drafts, and final stock-tank calculation still needs manual review.',
            parserPending: 'PDF parsing is still pending.',
            openDetails: 'Open detail tabs',
            openKnowledgeSearch: 'Open knowledge search',
            runtimeTitle: 'Model runtime',
            runtimeReady: 'Scenario linked',
            runtimeFallback: 'Monitoring first',
            runtimeUnavailable: 'Runtime unavailable',
            runtimeObserved: 'Observed signal',
            runtimeLai: 'LAI',
            runtimeBalance: 'Source/sink balance',
            runtimeCanopyA: 'Canopy assimilation',
            runtimeLimiting: 'Bottleneck',
            runtimeRecommended: 'Recommended now',
            runtimeLevers: 'Priority levers',
            summaryTitle: 'Summary',
            risksTitle: 'Risks',
            monitorTitle: 'Monitor',
            nowTitle: 'Now',
            todayTitle: 'Today',
            weekTitle: 'This week',
            noImmediateActions: 'No immediate intervention is recommended.',
            noTodayActions: 'Hold the current plan for today.',
            noWeekActions: 'No weekly adjustment has been assembled yet.',
            noRisks: 'No immediate risk is highlighted.',
            noMonitor: 'No extra monitoring items are listed.',
            fallbackTitle: 'Detailed explanation',
        };

    const advisoryBadges = smartGrowSummary
        ? [
            smartGrowSummary.pesticideReady ? copy.pesticideReady : null,
            smartGrowSummary.nutrientReady ? copy.nutrientReady : null,
            smartGrowSummary.nutrientCorrectionReady ? copy.correctionReady : null,
        ].filter((value): value is string => Boolean(value))
        : [];
    const correctionBoundary =
        smartGrowSummary?.nutrientCorrectionLimitation ?? copy.correctionBoundary;
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

    const fallbackSections = display ? [] : extractMarkdownSections(analysis);
    const summaryText = display?.summary?.trim() || '';
    const risks = display?.risks ?? [];
    const actionsNow = display?.actions_now ?? [];
    const actionsToday = display?.actions_today ?? [];
    const actionsWeek = display?.actions_week ?? [];
    const monitorItems = display?.monitor ?? [];

    return (
        <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-indigo-200/60 bg-gradient-to-br from-[#5361b7] via-[#4f56a7] to-[#42477d] p-6 text-white shadow-xl shadow-indigo-900/20">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-white/10 p-2.5">
                        <Sparkles className="h-5 w-5 text-amber-200" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold">{copy.title}</h3>
                        <p className="text-xs text-indigo-100">{copy.advisoryTitle}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isLoading}
                    aria-label={copy.title}
                    className={`rounded-2xl border border-white/15 bg-white/10 p-2 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${isLoading ? 'animate-spin' : ''}`}
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            <section className="mb-4 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                {smartGrowLoading ? (
                    <p className="text-xs text-indigo-50">{copy.advisoryLoading}</p>
                ) : smartGrowError ? (
                    <p className="text-xs text-rose-100">{copy.advisoryUnavailable}</p>
                ) : smartGrowSummary ? (
                    <>
                        {advisoryBadges.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {advisoryBadges.map((badge) => (
                                    <span
                                        key={badge}
                                        className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white"
                                    >
                                        {badge}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        <p className="mt-3 text-xs leading-relaxed text-indigo-50">{correctionBoundary}</p>
                        {smartGrowSummary.pendingParsers.includes('pdf') ? (
                            <p className="mt-2 text-[11px] text-indigo-200">{copy.parserPending}</p>
                        ) : null}
                        {(onOpenDetails || onOpenKnowledgeSearch) ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {onOpenDetails ? (
                                    <button
                                        type="button"
                                        onClick={onOpenDetails}
                                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                    >
                                        {copy.openDetails}
                                    </button>
                                ) : null}
                                {onOpenKnowledgeSearch ? (
                                    <button
                                        type="button"
                                        onClick={onOpenKnowledgeSearch}
                                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                    >
                                        {copy.openKnowledgeSearch}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </>
                ) : null}

                {modelRuntime ? (
                    <section className="mt-4 rounded-3xl border border-white/15 bg-slate-950/20 p-4">
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
                                    <AdvisorConfidenceBadge label={runtimeStatusLabel} tone={runtimeStatusTone} />
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
                            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-100">{copy.runtimeLai}</div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {formatRuntimeValue(runtimeState.lai, 2)}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-100">{copy.runtimeBalance}</div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {formatRuntimeValue(runtimeState.source_sink_balance, 2)}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-100">{copy.runtimeCanopyA}</div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {formatRuntimeValue(runtimeState.canopy_net_assimilation_umol_m2_s, 1, ' µmol')}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-100">{copy.runtimeLimiting}</div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {runtimeState.limiting_factor ?? '-'}
                                </div>
                            </div>
                        </div>
                        {(runtimeRecommended || runtimeTopLevers.length > 0) ? (
                            <div className="mt-3 space-y-2">
                                {runtimeRecommended ? (
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-100">
                                            {copy.runtimeRecommended}
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-white">{runtimeRecommended}</div>
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
                                                return (
                                                    <span
                                                        key={`${controlKey}-${lever.direction}`}
                                                        className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white"
                                                    >
                                                        {localizedControl ? localizedControl[locale] : controlKey || '-'}
                                                        {' · '}
                                                        {localizeDirection(lever.direction, locale)}
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
            </section>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center rounded-3xl border border-white/10 bg-white/10 px-6 text-sm text-indigo-100">
                        {copy.loading}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {summaryText ? (
                            <section className="rounded-3xl border border-white/10 bg-white/10 p-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-100">
                                    {copy.summaryTitle}
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-white">{summaryText}</p>
                            </section>
                        ) : null}

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                            <ActionColumn
                                title={copy.nowTitle}
                                items={actionsNow}
                                emptyLabel={copy.noImmediateActions}
                            />
                            <ActionColumn
                                title={copy.todayTitle}
                                items={actionsToday}
                                emptyLabel={copy.noTodayActions}
                            />
                            <ActionColumn
                                title={copy.weekTitle}
                                items={actionsWeek}
                                emptyLabel={copy.noWeekActions}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                            <section className="rounded-3xl border border-white/10 bg-white/10 p-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-100">
                                    {copy.risksTitle}
                                </div>
                                {risks.length > 0 ? (
                                    <ul className="mt-2 space-y-2 text-sm text-white">
                                        {risks.map((item) => (
                                            <li key={item} className="rounded-2xl bg-slate-950/20 px-3 py-2">
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-xs text-indigo-100">{copy.noRisks}</p>
                                )}
                            </section>
                            <section className="rounded-3xl border border-white/10 bg-white/10 p-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-100">
                                    {copy.monitorTitle}
                                </div>
                                {monitorItems.length > 0 ? (
                                    <ul className="mt-2 space-y-2 text-sm text-white">
                                        {monitorItems.map((item) => (
                                            <li key={item} className="rounded-2xl bg-slate-950/20 px-3 py-2">
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-xs text-indigo-100">{copy.noMonitor}</p>
                                )}
                            </section>
                        </div>

                        {!display && fallbackSections.length > 0 ? (
                            <section className="rounded-3xl border border-white/10 bg-white/10 p-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-100">
                                    {copy.fallbackTitle}
                                </div>
                                <div className="mt-3 space-y-3">
                                    {fallbackSections.map((section) => (
                                        <section
                                            key={`${section.title}-${section.body.slice(0, 24)}`}
                                            className="rounded-2xl border border-white/10 bg-slate-950/20 p-3"
                                        >
                                            <h4 className="mb-2 text-xs font-semibold tracking-[0.12em] text-indigo-100">
                                                {section.title}
                                            </h4>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h2: ({ ...props }) => <h2 className="mb-1 mt-2 text-sm font-semibold text-white" {...props} />,
                                                    h3: ({ ...props }) => <h3 className="mb-1 mt-2 text-xs font-semibold text-white/90" {...props} />,
                                                    p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                    ul: ({ ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />,
                                                    ol: ({ ...props }) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />,
                                                    li: ({ ...props }) => <li className="mb-0" {...props} />,
                                                    strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                                                    code: ({ ...props }) => <code className="rounded bg-white/10 px-1 py-0.5 text-white" {...props} />,
                                                }}
                                            >
                                                {section.body}
                                            </ReactMarkdown>
                                        </section>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {!display && fallbackSections.length === 0 ? (
                            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 text-sm text-indigo-100">
                                {copy.empty}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiAdvisor;
