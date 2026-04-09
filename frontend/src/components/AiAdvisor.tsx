import { RefreshCw, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocale } from '../i18n/LocaleProvider';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type {
    AdvisorDisplayPayload,
    ModelRuntimePayload,
} from '../hooks/useSmartGrowAdvisor';
import type { RagAssistantOpenRequest } from './chat/ragAssistantTypes';
import AdvisorConfidenceBadge from './advisor/AdvisorConfidenceBadge';

interface AiAdvisorProps {
    analysis: string;
    display?: AdvisorDisplayPayload | null;
    modelRuntime?: ModelRuntimePayload | null;
    error?: string | null;
    isLoading: boolean;
    onRefresh: () => void;
    onOpenDetails?: () => void;
    onOpenKnowledgeSearch?: (
        request?: Omit<RagAssistantOpenRequest, 'nonce'>,
    ) => void;
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
        <div className="rounded-[24px] bg-white/78 p-3" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                {title}
            </div>
            {items.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm leading-relaxed text-[color:var(--sg-text-strong)]">
                    {items.map((item) => (
                        <li key={item} className="rounded-[18px] bg-[color:var(--sg-surface-muted)] px-3 py-2">
                            {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 text-xs text-[color:var(--sg-text-faint)]">{emptyLabel}</p>
            )}
        </div>
    );
}

const AiAdvisor = ({
    analysis,
    display = null,
    modelRuntime = null,
    error = null,
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
            title: '재배 도움',
            loading: '실시간 데이터와 모델 상태를 분석하는 중입니다...',
            empty: '데이터가 더 쌓이면 실행 가능한 조치를 먼저 보여드립니다.',
            advisoryTitle: '바로 열 수 있는 도구',
            advisoryLoading: '바로 쓸 수 있는 도구 상태를 불러오는 중...',
            advisoryUnavailable: '도구 상태를 아직 불러오지 못했습니다.',
            advisoryHint: '연결된 화면과 세부 탭을 여기서 바로 열 수 있습니다.',
            pesticideReady: '농약 후보',
            nutrientReady: '양액 레시피',
            correctionReady: '양액 보정 초안',
            parserPending: '일부 자료는 아직 정리 중입니다.',
            openDetails: '세부 탭 보기',
            openKnowledgeSearch: '자료 찾기',
            runtimeTitle: '예측 모델 분석',
            runtimeReady: '예측 반영',
            runtimeFallback: '상태 해석 우선',
            runtimeUnavailable: '분석 정보 없음',
            runtimeObserved: '실측 반영',
            runtimeLai: 'LAI',
            runtimeBalance: '공급/수요 균형',
            runtimeCanopyA: '캐노피 동화량',
            runtimeLimiting: '제한 요인',
            runtimeRecommended: '지금 권장',
            runtimeLevers: '주요 환경 요인',
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
            analysisUnavailable: '분석 응답을 불러오지 못했습니다.',
        }
        : {
            title: 'Grower support',
            loading: 'Analyzing live data and model state...',
            empty: 'Actionable guidance will appear once enough data accumulates.',
            advisoryTitle: 'Ready-to-open tools',
            advisoryLoading: 'Loading the ready-to-open tool state...',
            advisoryUnavailable: 'Tool status is unavailable.',
            advisoryHint: 'Open connected screens or detailed tabs from here.',
            pesticideReady: 'Pesticide lookup',
            nutrientReady: 'Nutrient recipe',
            correctionReady: 'Correction draft',
            parserPending: 'Some documents are still being prepared.',
            openDetails: 'Open detail tabs',
            openKnowledgeSearch: 'Find materials',
            runtimeTitle: 'Model runtime',
            runtimeReady: 'Recommendation linked',
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
            analysisUnavailable: 'Analysis response is unavailable.',
        };

    const advisoryBadges = smartGrowSummary
        ? [
            smartGrowSummary.pesticideReady ? copy.pesticideReady : null,
            smartGrowSummary.nutrientReady ? copy.nutrientReady : null,
            smartGrowSummary.nutrientCorrectionReady ? copy.correctionReady : null,
        ].filter((value): value is string => Boolean(value))
        : [];
    const knowledgeSearchActions: Array<{
        label: string;
        request: Omit<RagAssistantOpenRequest, 'nonce'>;
    }> = [];
    if (onOpenKnowledgeSearch && smartGrowSummary?.pesticideReady) {
        knowledgeSearchActions.push({
            label: locale === 'ko' ? '병해충 자료' : 'Pest notes',
            request: {
                preset: 'pesticide',
                autoRun: true,
                source: 'advisor',
            },
        });
    }
    if (onOpenKnowledgeSearch && smartGrowSummary?.nutrientReady) {
        knowledgeSearchActions.push({
            label: locale === 'ko' ? '양액 자료' : 'Nutrient notes',
            request: {
                preset: 'nutrient',
                autoRun: true,
                source: 'advisor',
            },
        });
    }
    if (onOpenKnowledgeSearch && smartGrowSummary?.nutrientCorrectionReady) {
        knowledgeSearchActions.push({
            label: locale === 'ko' ? '양액 점검 자료' : 'Correction checks',
            request: {
                preset: 'nutrient',
                query:
                    locale === 'ko'
                        ? '양액 보정 초안의 수동 검토 경계'
                        : 'manual-review guardrails for the nutrient correction draft',
                autoRun: true,
                source: 'advisor',
            },
        });
    }
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
        <div
            className="flex h-full flex-col overflow-hidden rounded-[28px] p-6 text-[color:var(--sg-text-strong)]"
            style={{
                background: 'linear-gradient(145deg, rgba(255,248,243,0.98), rgba(243,228,220,0.92) 55%, rgba(231,214,204,0.88))',
                boxShadow: 'var(--sg-shadow-soft)',
            }}
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-white/84 p-2.5" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        <Sparkles className="h-5 w-5 text-[color:var(--sg-accent-violet)]" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold">{copy.title}</h3>
                        <p className="text-xs text-[color:var(--sg-text-faint)]">{copy.advisoryTitle}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isLoading}
                    aria-label={copy.title}
                    className={`rounded-2xl bg-white/84 p-2 text-[color:var(--sg-text-strong)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent-violet)] ${isLoading ? 'animate-spin' : ''}`}
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            <section
                className="mb-4 rounded-[28px] bg-white/78 p-4"
                style={{ boxShadow: 'var(--sg-shadow-card)' }}
            >
                {smartGrowLoading ? (
                    <p className="text-xs text-[color:var(--sg-text-faint)]">{copy.advisoryLoading}</p>
                ) : smartGrowError ? (
                    <p className="text-xs text-[color:var(--sg-accent-danger)]">{copy.advisoryUnavailable}: {smartGrowError}</p>
                ) : smartGrowSummary ? (
                    <>
                        {advisoryBadges.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {advisoryBadges.map((badge) => (
                                    <span
                                        key={badge}
                                        className="rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-medium text-[color:var(--sg-accent-violet)]"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        {badge}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        <p className="mt-3 text-xs leading-relaxed text-[color:var(--sg-text-muted)]">{copy.advisoryHint}</p>
                        {smartGrowSummary.pendingParsers.includes('pdf') ? (
                            <p className="mt-2 text-[11px] text-[color:var(--sg-text-faint)]">{copy.parserPending}</p>
                        ) : null}
                        {(onOpenDetails || onOpenKnowledgeSearch) ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {onOpenDetails ? (
                                    <button
                                        type="button"
                                        onClick={onOpenDetails}
                                        className="rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-[color:var(--sg-text-strong)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent-violet)]"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        {copy.openDetails}
                                    </button>
                                ) : null}
                                {onOpenKnowledgeSearch && knowledgeSearchActions.length === 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => onOpenKnowledgeSearch({ source: 'advisor' })}
                                        className="rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-[color:var(--sg-text-strong)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent-violet)]"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        {copy.openKnowledgeSearch}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                        {knowledgeSearchActions.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {knowledgeSearchActions.map((action) => (
                                    <button
                                        key={action.label}
                                        type="button"
                                        onClick={() => onOpenKnowledgeSearch?.(action.request)}
                                        className="rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-[color:var(--sg-text-strong)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent-violet)]"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </>
                ) : null}

                {error ? (
                    <p className="mt-3 text-xs text-[color:var(--sg-accent-danger)]">
                        {copy.analysisUnavailable}: {error}
                    </p>
                ) : null}

                {modelRuntime ? (
                    <section
                        className="mt-4 rounded-[28px] bg-[color:var(--sg-surface-muted)] p-4"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                                    {copy.runtimeTitle}
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-[color:var(--sg-text-muted)]">
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
                            <div className="rounded-[20px] bg-white/88 px-3 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">{copy.runtimeLai}</div>
                                <div className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                    {formatRuntimeValue(runtimeState.lai, 2)}
                                </div>
                            </div>
                            <div className="rounded-[20px] bg-white/88 px-3 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">{copy.runtimeBalance}</div>
                                <div className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                    {formatRuntimeValue(runtimeState.source_sink_balance, 2)}
                                </div>
                            </div>
                            <div className="rounded-[20px] bg-white/88 px-3 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">{copy.runtimeCanopyA}</div>
                                <div className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                    {formatRuntimeValue(runtimeState.canopy_net_assimilation_umol_m2_s, 1, ' µmol')}
                                </div>
                            </div>
                            <div className="rounded-[20px] bg-white/88 px-3 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">{copy.runtimeLimiting}</div>
                                <div className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                    {runtimeState.limiting_factor ?? '-'}
                                </div>
                            </div>
                        </div>
                        {(runtimeRecommended || runtimeTopLevers.length > 0) ? (
                            <div className="mt-3 space-y-2">
                                {runtimeRecommended ? (
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                            {copy.runtimeRecommended}
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-[color:var(--sg-text-strong)]">{runtimeRecommended}</div>
                                    </div>
                                ) : null}
                                {runtimeTopLevers.length > 0 ? (
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
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
                                                        className="rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-medium text-[color:var(--sg-text-strong)]"
                                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
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
                    <div
                        className="flex h-full items-center justify-center rounded-[28px] bg-white/78 px-6 text-sm text-[color:var(--sg-text-faint)]"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        {copy.loading}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {summaryText ? (
                            <section className="rounded-[28px] bg-white/78 p-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                                    {copy.summaryTitle}
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-[color:var(--sg-text-strong)]">{summaryText}</p>
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
                            <section className="rounded-[28px] bg-white/78 p-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                                    {copy.risksTitle}
                                </div>
                                {risks.length > 0 ? (
                                    <ul className="mt-2 space-y-2 text-sm text-[color:var(--sg-text-strong)]">
                                        {risks.map((item) => (
                                            <li key={item} className="rounded-[20px] bg-[color:var(--sg-surface-muted)] px-3 py-2">
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-xs text-[color:var(--sg-text-faint)]">{copy.noRisks}</p>
                                )}
                            </section>
                            <section className="rounded-[28px] bg-white/78 p-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                                    {copy.monitorTitle}
                                </div>
                                {monitorItems.length > 0 ? (
                                    <ul className="mt-2 space-y-2 text-sm text-[color:var(--sg-text-strong)]">
                                        {monitorItems.map((item) => (
                                            <li key={item} className="rounded-[20px] bg-[color:var(--sg-surface-muted)] px-3 py-2">
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-xs text-[color:var(--sg-text-faint)]">{copy.noMonitor}</p>
                                )}
                            </section>
                        </div>

                        {!display && fallbackSections.length > 0 ? (
                            <section className="rounded-[28px] bg-white/78 p-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                                    {copy.fallbackTitle}
                                </div>
                                <div className="mt-3 space-y-3">
                                    {fallbackSections.map((section) => (
                                        <section
                                            key={`${section.title}-${section.body.slice(0, 24)}`}
                                            className="rounded-[22px] bg-[color:var(--sg-surface-muted)] p-3"
                                        >
                                            <h4 className="mb-2 text-xs font-semibold tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                                                {section.title}
                                            </h4>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h2: ({ ...props }) => <h2 className="mb-1 mt-2 text-sm font-semibold text-[color:var(--sg-text-strong)]" {...props} />,
                                                    h3: ({ ...props }) => <h3 className="mb-1 mt-2 text-xs font-semibold text-[color:var(--sg-text-muted)]" {...props} />,
                                                    p: ({ ...props }) => <p className="mb-2 last:mb-0 text-[color:var(--sg-text-muted)]" {...props} />,
                                                    ul: ({ ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />,
                                                    ol: ({ ...props }) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />,
                                                    li: ({ ...props }) => <li className="mb-0" {...props} />,
                                                    strong: ({ ...props }) => <strong className="font-semibold text-[color:var(--sg-text-strong)]" {...props} />,
                                                    code: ({ ...props }) => <code className="rounded bg-white/84 px-1 py-0.5 text-[color:var(--sg-text-strong)]" {...props} />,
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
                            <div className="rounded-[28px] bg-white/78 p-4 text-sm text-[color:var(--sg-text-faint)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
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
