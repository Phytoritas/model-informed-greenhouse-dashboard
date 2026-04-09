import type { ModelRuntimePayload } from '../../hooks/useSmartGrowAdvisor';
import { useLocale } from '../../i18n/LocaleProvider';
import { getLocalizedTokenLabel } from '../../utils/displayCopy';
import AdvisorConfidenceBadge from './AdvisorConfidenceBadge';

interface AdvisorModelRuntimePanelProps {
    runtime?: ModelRuntimePayload | null;
}

const CONTROL_LABELS = {
    co2_setpoint_day: { ko: '주간 CO2', en: 'Day CO2' },
    temperature_day: { ko: '주간 온도', en: 'Day temperature' },
    temperature_night: { ko: '야간 온도', en: 'Night temperature' },
    rh_target: { ko: '상대습도 목표', en: 'RH target' },
    screen_close: { ko: '스크린 폐쇄', en: 'Screen close' },
} as const;

const TIME_WINDOW_LABELS = {
    now: { ko: '지금', en: 'Now' },
    today: { ko: '오늘', en: 'Today' },
    this_week: { ko: '이번주', en: 'This week' },
} as const;

const LEAF_LAYER_LABELS = {
    upper: { ko: '상엽', en: 'Upper' },
    middle: { ko: '중엽', en: 'Middle' },
    bottom: { ko: '하엽', en: 'Bottom' },
} as const;

function formatNumber(
    value: number | null | undefined,
    digits = 1,
    unit = '',
) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '-';
    }
    return `${value.toFixed(digits)}${unit}`;
}

function clampPercent(value: number) {
    return Math.max(8, Math.min(100, value));
}

const AdvisorModelRuntimePanel = ({
    runtime = null,
}: AdvisorModelRuntimePanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            title: '예측 모델 분석',
            subtitleReady: '시나리오 예측 + 주요 환경 요인',
            subtitleFallback: '상태 해석 중심 분석',
            noRuntime: '이번 응답에는 예측 모델 분석이 아직 붙지 않았습니다.',
            statusReady: '예측 반영',
            statusFallback: '상태 해석 우선',
            stateTitle: '현재 모델 상태',
            sensitivityTitle: '주요 환경 요인',
            compareTitle: '조건별 비교',
            constraintsTitle: '제약 확인',
            observed: '실측 반영',
            lai: 'LAI',
            balance: '공급/수요 균형',
            canopyA: '캐노피 동화량',
            limiting: '제한 요인',
            leafLayers: '상·중·하엽 활력',
            inferred: '보정 필드',
            missing: '누락 필드',
            recommended: '추천',
            compareEmpty: '아직 강한 비교 옵션이 정렬되지 않았습니다.',
            yield7d: '7일 수확',
            yield14d: '14일 수확',
            energy: '에너지',
            balanceDelta: '균형 회복',
            elasticity: '영향력',
            trust: '안전 범위',
            alignment: '예측 일치',
            violations: '위반',
            noViolations: '위반 없음',
            fallbackHint: '현재는 모델 입력이 부분적이라 상태와 방향성만 먼저 보여드립니다.',
        }
        : {
            title: 'Model runtime',
            subtitleReady: 'bounded scenario + local sensitivity',
            subtitleFallback: 'monitoring-first runtime view',
            noRuntime: 'No model runtime block is attached to this response yet.',
            statusReady: 'recommendation linked',
            statusFallback: 'monitoring-first',
            stateTitle: 'Current model state',
            sensitivityTitle: 'Top-3 levers',
            compareTitle: 'Scenario compare',
            constraintsTitle: 'Constraint status',
            observed: 'Observed signal',
            lai: 'LAI',
            balance: 'Source/sink',
            canopyA: 'Canopy A',
            limiting: 'Bottleneck',
            leafLayers: 'Upper / middle / bottom activity',
            inferred: 'Inferred fields',
            missing: 'Missing fields',
            recommended: 'Recommended',
            compareEmpty: 'No strong bounded option has been ranked yet.',
            yield7d: '7d yield',
            yield14d: '14d yield',
            energy: 'Energy',
            balanceDelta: 'Balance recovery',
            elasticity: 'Elasticity',
            trust: 'Trust region',
            alignment: 'Recommendation align',
            violations: 'Violations',
            noViolations: 'No violations',
            fallbackHint: 'The current runtime only exposes state and directionality because model inputs are partial.',
        };

    if (!runtime) {
        return (
            <section className="sg-warm-panel p-5">
                <div className="text-sm text-[color:var(--sg-text-muted)]">{copy.noRuntime}</div>
            </section>
        );
    }

    const state = runtime.state_snapshot ?? {};
    const topLevers = runtime.sensitivity?.top_levers ?? [];
    const compareOptions = runtime.scenario?.options?.length
        ? runtime.scenario.options
        : runtime.recommendations ?? [];
    const recommendedAction = runtime.scenario?.recommended?.action ?? null;
    const maxElasticity = Math.max(
        ...topLevers.map((lever) => Math.abs(Number(lever.elasticity ?? 0))),
        0.01,
    );
    const violations = runtime.constraint_checks?.violated_constraints ?? [];
    const observedSignalScore = Number(state.observed_signal_score ?? 0);
    const layerActivity = [
        { key: 'upper', value: Number(state.upper_leaf_activity ?? 0), tone: 'from-[#cf8a62] to-[#a14a35]' },
        { key: 'middle', value: Number(state.middle_leaf_activity ?? 0), tone: 'from-[#d7a06e] to-[#b46d4f]' },
        { key: 'bottom', value: Number(state.bottom_leaf_activity ?? 0), tone: 'from-amber-300 to-amber-500' },
    ] as const;

    return (
        <section className="rounded-[30px] border border-[rgba(122,67,52,0.16)] bg-gradient-to-br from-[#4c291f] via-[#6a382b] to-[#8a4f3b] p-5 text-white shadow-[0_24px_64px_rgba(92,48,36,0.28)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(255,232,214,0.82)]">
                        {copy.title}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold">
                        {runtime.status === 'ready' ? copy.subtitleReady : copy.subtitleFallback}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[rgba(255,239,228,0.84)]">
                        {runtime.summary}
                    </p>
                    {runtime.status !== 'ready' ? (
                        <p className="mt-2 text-xs leading-relaxed text-[rgba(255,235,220,0.82)]">
                            {copy.fallbackHint}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                    <AdvisorConfidenceBadge
                        label={runtime.status === 'ready' ? copy.statusReady : copy.statusFallback}
                        tone={runtime.status === 'ready' ? 'success' : 'warning'}
                    />
                    <AdvisorConfidenceBadge
                        label={`${copy.observed}:${Math.round(observedSignalScore * 100)}%`}
                        tone="info"
                    />
                    {recommendedAction ? (
                        <AdvisorConfidenceBadge label={copy.recommended} tone="success" />
                    ) : null}
                    {violations.length ? (
                        <AdvisorConfidenceBadge
                            label={`${copy.violations}:${violations.length}`}
                            tone="warning"
                        />
                    ) : null}
                </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-4">
                    <div className="rounded-[24px] border border-[rgba(255,237,225,0.14)] bg-[rgba(255,244,237,0.10)] p-4 backdrop-blur-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                            {copy.stateTitle}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-[rgba(255,237,225,0.14)] bg-[rgba(58,29,22,0.24)] p-3">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                    {copy.lai}
                                </div>
                                <div className="mt-2 text-lg font-semibold">{formatNumber(state.lai, 2)}</div>
                            </div>
                            <div className="rounded-2xl border border-[rgba(255,237,225,0.14)] bg-[rgba(58,29,22,0.24)] p-3">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                    {copy.balance}
                                </div>
                                <div className="mt-2 text-lg font-semibold">
                                    {formatNumber(state.source_sink_balance, 2)}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-[rgba(255,237,225,0.14)] bg-[rgba(58,29,22,0.24)] p-3">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                    {copy.canopyA}
                                </div>
                                <div className="mt-2 text-lg font-semibold">
                                    {formatNumber(state.canopy_net_assimilation_umol_m2_s, 1, ' µmol')}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-[rgba(255,237,225,0.14)] bg-[rgba(58,29,22,0.24)] p-3">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                    {copy.limiting}
                                </div>
                                <div className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-[rgba(255,232,214,0.92)]">
                                    {getLocalizedTokenLabel(state.limiting_factor ?? '-', locale)}
                                </div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                {copy.leafLayers}
                            </div>
                            <div className="mt-3 space-y-2">
                                {layerActivity.map((item) => (
                                    <div key={item.key}>
                                        <div className="mb-1 flex items-center justify-between text-xs text-[rgba(255,239,228,0.84)]">
                                            <span className="uppercase tracking-[0.14em]">
                                                {LEAF_LAYER_LABELS[item.key][locale]}
                                            </span>
                                            <span>{formatNumber(item.value * 100, 0, '%')}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-white/10">
                                            <div
                                                className={`h-2 rounded-full bg-gradient-to-r ${item.tone}`}
                                                style={{ width: `${clampPercent(item.value * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {state.dashboard_missing_fields?.length || state.inferred_fields?.length ? (
                        <div className="rounded-[24px] border border-[rgba(255,237,225,0.14)] bg-[rgba(58,29,22,0.24)] p-4">
                            <div className="flex flex-wrap gap-4">
                                {state.dashboard_missing_fields?.length ? (
                                    <div className="space-y-2">
                                        <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                            {copy.missing}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {state.dashboard_missing_fields.map((item) => (
                                                <AdvisorConfidenceBadge key={item} label={getLocalizedTokenLabel(item, locale)} tone="warning" />
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                                {state.inferred_fields?.length ? (
                                    <div className="space-y-2">
                                        <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                            {copy.inferred}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {state.inferred_fields.map((item) => (
                                                <AdvisorConfidenceBadge key={item} label={getLocalizedTokenLabel(item, locale)} tone="neutral" />
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                        <div className="rounded-[24px] border border-[rgba(255,237,225,0.14)] bg-[rgba(255,244,237,0.10)] p-4 backdrop-blur-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                {copy.sensitivityTitle}
                            </div>
                            <div className="mt-3 space-y-3">
                                {topLevers.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-[rgba(255,237,225,0.14)] bg-[rgba(58,29,22,0.18)] px-3 py-3 text-sm text-[rgba(255,235,220,0.72)]">
                                        {copy.compareEmpty}
                                    </div>
                                ) : topLevers.map((lever) => {
                                    const controlKey = String(lever.control ?? '');
                                    const localizedControl = CONTROL_LABELS[controlKey as keyof typeof CONTROL_LABELS];
                                    const width = clampPercent((Math.abs(Number(lever.elasticity ?? 0)) / maxElasticity) * 100);
                                    return (
                                        <div
                                            key={`${controlKey}-${lever.direction}`}
                                            className="rounded-2xl border border-[rgba(255,237,225,0.14)] bg-[rgba(58,29,22,0.24)] p-4"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-white">
                                                        {localizedControl
                                                            ? localizedControl[locale]
                                                            : controlKey}
                                                    </div>
                                                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                                        {copy.elasticity}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <AdvisorConfidenceBadge
                                                        label={getLocalizedTokenLabel(String(lever.direction ?? '-'), locale)}
                                                        tone={lever.scenario_alignment ? 'success' : 'warning'}
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-3 h-2 rounded-full bg-white/10">
                                                <div
                                                    className="h-2 rounded-full bg-gradient-to-r from-[#d7a06e] to-[#a14a35]"
                                                    style={{ width: `${width}%` }}
                                                />
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[rgba(255,239,228,0.84)]">
                                                <span>{formatNumber(lever.elasticity, 2)}</span>
                                                <span>
                                                    {copy.trust}:{' '}
                                                    {formatNumber(lever.trust_region?.low, 0)} ~{' '}
                                                    {formatNumber(lever.trust_region?.high, 0)}
                                                </span>
                                                <span>
                                                    {copy.alignment}:{' '}
                                                    {getLocalizedTokenLabel(lever.scenario_alignment ? 'yes' : 'no', locale)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-[rgba(255,237,225,0.14)] bg-[rgba(255,244,237,0.10)] p-4 backdrop-blur-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                    {copy.compareTitle}
                                </div>
                                {recommendedAction ? (
                                    <AdvisorConfidenceBadge label={copy.recommended} tone="success" />
                                ) : null}
                            </div>
                            <div className="mt-3 space-y-3">
                                {compareOptions.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-[rgba(255,237,225,0.14)] bg-[rgba(58,29,22,0.18)] px-3 py-3 text-sm text-[rgba(255,235,220,0.72)]">
                                        {copy.compareEmpty}
                                    </div>
                                ) : compareOptions.slice(0, 3).map((option) => {
                                    const timeWindowKey = option.time_window as keyof typeof TIME_WINDOW_LABELS;
                                    const timeWindowLabel = TIME_WINDOW_LABELS[timeWindowKey]?.[locale] ?? option.time_window;
                                    const isRecommended = runtime.scenario?.recommended?.action === option.action;
                                    const optionViolations = Array.isArray(option.violated_constraints)
                                        ? option.violated_constraints
                                        : [];
                                    return (
                                        <div
                                            key={`${option.action}-${option.control}`}
                                            className={`rounded-2xl border p-4 ${
                                                isRecommended
                                                    ? 'border-[rgba(240,198,172,0.52)] bg-[rgba(255,240,230,0.12)]'
                                                    : 'border-[rgba(255,237,225,0.14)] bg-[rgba(58,29,22,0.24)]'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-white">
                                                        {option.action}
                                                    </div>
                                                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[rgba(255,235,220,0.72)]">
                                                        {timeWindowLabel}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <AdvisorConfidenceBadge
                                                        label={`${getLocalizedTokenLabel('score', locale)} ${formatNumber(option.score, 2)}`}
                                                        tone={isRecommended ? 'success' : 'info'}
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-3 grid gap-2 text-sm text-[rgba(255,239,228,0.84)] sm:grid-cols-2">
                                                <div>{copy.yield7d}: {formatNumber(option.expected_yield_delta_7d, 2, ' kg')}</div>
                                                <div>{copy.yield14d}: {formatNumber(option.expected_yield_delta_14d, 2, ' kg')}</div>
                                                <div>{copy.energy}: {formatNumber(option.expected_energy_delta, 2, ' kWh')}</div>
                                                <div>{copy.balanceDelta}: {formatNumber(option.expected_source_sink_balance_delta, 2)}</div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {(optionViolations.length
                                                    ? optionViolations
                                                    : [{ code: copy.noViolations, severity: 'success', message: copy.noViolations }]
                                                ).map((violation, index) => (
                                                    <AdvisorConfidenceBadge
                                                        key={`${option.action}-${violation.code}-${index}`}
                                                        label={getLocalizedTokenLabel(violation.code, locale)}
                                                        tone={
                                                            violation.severity === 'high'
                                                                ? 'danger'
                                                                : violation.severity === 'medium'
                                                                    ? 'warning'
                                                                    : 'success'
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {violations.length ? (
                        <div className="rounded-[24px] border border-amber-300/25 bg-amber-400/10 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                                {copy.constraintsTitle}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {violations.map((violation, index) => (
                                    <AdvisorConfidenceBadge
                                        key={`${violation.code}-${index}`}
                                        label={`${getLocalizedTokenLabel(violation.code, locale)}${violation.control ? `:${getLocalizedTokenLabel(violation.control, locale)}` : ''}`}
                                        tone={violation.severity === 'high' ? 'danger' : 'warning'}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
};

export default AdvisorModelRuntimePanel;
