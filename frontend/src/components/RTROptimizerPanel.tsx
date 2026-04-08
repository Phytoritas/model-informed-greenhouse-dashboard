import { useEffect, useMemo } from 'react';
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    BadgeAlert,
    CheckCircle2,
    CircleGauge,
    FlaskConical,
    Leaf,
    Thermometer,
} from 'lucide-react';
import type {
    CropType,
    RtrCropSpecificInsight,
    RtrOptimizationMode,
    RtrProfile,
    SensorData,
    TemperatureSettings,
    WeatherOutlook,
} from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { getCropLabel } from '../utils/displayCopy';
import { useAreaUnit } from '../context/AreaUnitContext';
import { useRtrOptimizer } from '../hooks/useRtrOptimizer';
import AreaUnitPanel from './AreaUnitPanel';
import RTROutlookPanel from './RTROutlookPanel';

interface RTROptimizerPanelProps {
    crop: CropType;
    currentData: SensorData;
    history: SensorData[];
    temperatureSettings: TemperatureSettings;
    weather: WeatherOutlook | null;
    loading: boolean;
    error: string | null;
    profile: RtrProfile | null;
    profileLoading: boolean;
    profileError: string | null;
    optimizerEnabled?: boolean;
    defaultMode?: RtrOptimizationMode;
    compact?: boolean;
}

const MODE_ORDER: RtrOptimizationMode[] = [
    'growth_priority',
    'balanced',
    'energy_saving',
    'labor_saving',
];
const DEFAULT_OPTIMIZATION_MODE: RtrOptimizationMode = 'balanced';

function formatNumber(
    value: number | null | undefined,
    digits = 1,
    locale: 'en' | 'ko' = 'ko',
): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '-';
    }

    return value.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function getModeLabel(mode: string, locale: 'en' | 'ko'): string {
    if (locale === 'ko') {
        if (mode === 'growth_priority') return '생장 우선';
        if (mode === 'energy_saving') return '에너지 절감';
        if (mode === 'labor_saving') return '작업 절감';
        if (mode === 'custom_weights') return '사용자 가중치';
        if (mode === 'baseline') return '기준선';
        return '균형';
    }

    if (mode === 'growth_priority') return 'Growth';
    if (mode === 'energy_saving') return 'Energy';
    if (mode === 'labor_saving') return 'Labor';
    if (mode === 'custom_weights') return 'Custom';
    if (mode === 'baseline') return 'Baseline';
    return 'Balanced';
}

function getScenarioLabel(label: string, locale: 'en' | 'ko'): string {
    const knownModes = new Set([
        'growth_priority',
        'balanced',
        'energy_saving',
        'labor_saving',
        'custom_weights',
        'baseline',
    ]);

    return knownModes.has(label) ? getModeLabel(label, locale) : label;
}

function getWarningLabel(code: string, locale: 'en' | 'ko'): string {
    const koMap: Record<string, string> = {
        recent_leaf_removal_missing: '최근 적엽 기록 필요',
        recent_fruit_thinning_missing: '최근 적과 기록 필요',
        risk_bound_active: '위험 제약 적용 중',
        large_rtr_deviation_reason_required: 'RTR 편차 이유 설명 필요',
    };
    const enMap: Record<string, string> = {
        recent_leaf_removal_missing: 'Leaf-removal history needed',
        recent_fruit_thinning_missing: 'Fruit-thinning history needed',
        risk_bound_active: 'Risk bound active',
        large_rtr_deviation_reason_required: 'Large RTR deviation',
    };

    return (locale === 'ko' ? koMap[code] : enMap[code]) ?? code;
}

function getReasonTagLabel(code: string, locale: 'en' | 'ko'): string {
    const koMap: Record<string, string> = {
        'temperature-up': '기준선보다 온도 상향',
        'temperature-down': '기준선보다 온도 하향',
        'node-target-guarded': '목표 마디 속도 방어',
        'respiration-tradeoff': '호흡 손실 증가 억제',
        'energy-tradeoff': '에너지 비용 고려',
        'labor-tradeoff': '작업량 증가 고려',
    };
    const enMap: Record<string, string> = {
        'temperature-up': 'Higher than baseline',
        'temperature-down': 'Lower than baseline',
        'node-target-guarded': 'Node target guarded',
        'respiration-tradeoff': 'Respiration trade-off',
        'energy-tradeoff': 'Energy trade-off',
        'labor-tradeoff': 'Labor trade-off',
    };

    return (locale === 'ko' ? koMap[code] : enMap[code]) ?? code;
}

function getSensitivityControlLabel(code: string, locale: 'en' | 'ko'): string {
    const koMap: Record<string, string> = {
        temperature_day: '주간 온도',
        temperature_night: '야간 온도',
        temperature_mean: '평균 온도',
    };
    const enMap: Record<string, string> = {
        temperature_day: 'Day temperature',
        temperature_night: 'Night temperature',
        temperature_mean: 'Mean temperature',
    };

    return (locale === 'ko' ? koMap[code] : enMap[code]) ?? code;
}

function getSensitivityTargetLabel(code: string, locale: 'en' | 'ko'): string {
    const koMap: Record<string, string> = {
        predicted_node_rate_day: '예측 마디 전개',
        carbon_margin: '탄소 마진',
        energy_cost: '에너지 비용',
    };
    const enMap: Record<string, string> = {
        predicted_node_rate_day: 'Predicted node rate',
        carbon_margin: 'Carbon margin',
        energy_cost: 'Energy cost',
    };

    return (locale === 'ko' ? koMap[code] : enMap[code]) ?? code;
}

function renderCropSpecificInsight(
    insight: RtrCropSpecificInsight | null,
    locale: 'en' | 'ko',
) {
    if (!insight) {
        return null;
    }

    if (insight.crop === 'cucumber') {
        return (
            <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">{locale === 'ko' ? '남은 엽수' : 'Remaining leaves'}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(insight.remaining_leaves, 0, locale)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">{locale === 'ko' ? '병목 엽층' : 'Bottleneck layer'}</div>
                    <div className="mt-1 text-lg font-semibold capitalize text-slate-900">
                        {locale === 'ko'
                            ? insight.bottleneck_layer === 'upper'
                                ? '상위엽'
                                : insight.bottleneck_layer === 'middle'
                                    ? '중위엽'
                                    : '하위엽'
                            : insight.bottleneck_layer}
                    </div>
                </div>
                <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                    <div className="text-[11px] text-slate-500">{locale === 'ko' ? '상/중/하 엽 활동도' : 'Layer activity'}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-700">
                        <span>{locale === 'ko' ? '상위엽' : 'Upper'} {formatNumber(insight.layer_activity.upper, 2, locale)}</span>
                        <span>{locale === 'ko' ? '중위엽' : 'Middle'} {formatNumber(insight.layer_activity.middle, 2, locale)}</span>
                        <span>{locale === 'ko' ? '하위엽' : 'Bottom'} {formatNumber(insight.layer_activity.bottom, 2, locale)}</span>
                    </div>
                </div>
                <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                    <div className="text-[11px] text-slate-500">{locale === 'ko' ? '최근 적엽 이벤트' : 'Recent leaf-removal events'}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatNumber(insight.recent_leaf_removal_count, 0, locale)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">{locale === 'ko' ? '활성 화방' : 'Active trusses'}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(insight.active_trusses, 0, locale)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">{locale === 'ko' ? '과실 분배비' : 'Fruit partition ratio'}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(insight.fruit_partition_ratio, 2, locale)}</div>
            </div>
            <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                <div className="text-[11px] text-slate-500">{locale === 'ko' ? '주요 sink cohort' : 'Dominant cohort'}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                    {insight.dominant_cohort_id ?? '-'} / {formatNumber(insight.dominant_cohort_sink, 2, locale)}
                </div>
            </div>
            <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                <div className="text-[11px] text-slate-500">{locale === 'ko' ? '최근 적과 이벤트' : 'Recent thinning events'}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                    {formatNumber(insight.recent_fruit_thinning_count, 0, locale)}
                </div>
            </div>
        </div>
    );
}

const RTROptimizerPanel = ({
    crop,
    currentData,
    history,
    temperatureSettings,
    weather,
    loading,
    error,
    profile,
    profileLoading,
    profileError,
    optimizerEnabled: optimizerEnabledProp,
    defaultMode: defaultModeProp,
    compact = false,
}: RTROptimizerPanelProps) => {
    const { locale } = useLocale();
    const { areaByCrop, setActualAreaM2, setActualAreaPyeong, syncAreaMeta } = useAreaUnit();
    const areaState = areaByCrop[crop];
    const optimizerEnabled = profileLoading ? false : (profile?.optimizer?.enabled ?? optimizerEnabledProp ?? false);
    const defaultMode = defaultModeProp ?? profile?.optimizer?.default_mode ?? DEFAULT_OPTIMIZATION_MODE;
    const {
        stateResponse,
        optimizeResponse,
        scenarioResponse,
        sensitivityResponse,
        targetNodeDevelopmentPerDay,
        setTargetNodeDevelopmentPerDay,
        optimizationMode,
        setOptimizationMode,
        includeEnergyCost,
        setIncludeEnergyCost,
        includeLaborCost,
        setIncludeLaborCost,
        loading: optimizerLoading,
        loadingState,
        loadingOptimize,
        error: optimizerError,
        refreshOptimization,
    } = useRtrOptimizer({
        crop,
        actualAreaM2: areaState.actualAreaM2,
        actualAreaPyeong: areaState.actualAreaPyeong,
        actualAreaSource: areaState.source,
        optimizerEnabled,
        defaultMode,
    });
    const isProfilePending = profileLoading && profile === null;
    const isProfileUnavailable = !profileLoading && profile === null;

    const copy = locale === 'ko'
        ? {
            title: 'RTR 최적화',
            subtitle: `${getCropLabel(crop, locale)} 목표 마디 전개를 위한 최소 충분 온도`,
            targetNode: '목표 마디 전개',
            predictedNode: '현재 예측 전개',
            recommendedMeanTemp: '추천 평균 온도',
            deltaTemp: '기준선 대비 ΔT',
            rtrEquivalent: '최적 RTR 환산값',
            confidence: '신뢰도',
            gainLoss: '이득/손실 균형',
            cropInsight: '작물별 해석',
            setpoints: '추천 설정값',
            scenarios: '시나리오 비교',
            baselineCard: '기준선 비교 카드',
            refresh: '다시 계산',
            includeEnergy: '에너지 비용 포함',
            includeLabor: '작업부하 포함',
            dayMin: '주간 최소 온도',
            nightMin: '야간 최소 온도',
            ventBias: '환기 편차',
            screenBias: '스크린 편차',
            carbonMargin: '탄소 마진',
            assimilationGain: '광합성 이득',
            respirationCost: '호흡 손실',
            energyCost: '에너지 비용',
            laborCost: '작업부하',
            targetHit: '목표 충족',
            yes: '충족',
            no: '보류',
            sensitivity: '온도 민감도',
            noScenario: '시나리오 계산 결과가 아직 없습니다.',
            computing: 'RTR 최적화를 계산하는 중...',
            modeHeader: '모드',
            meanHeader: '평균온도',
            nodeHeader: '마디/일',
            carbonHeader: '탄소',
            respHeader: '호흡',
            energyHeader: '에너지',
            laborHeader: '작업',
            disabledTitle: 'RTR 기준선 모니터',
            disabledBody: '이 프로파일은 아직 optimizer를 켜지 않아 기준선 모니터만 제공합니다.',
            profileLoadingTitle: 'RTR 프로파일 준비 중',
            profileLoadingBody: '프로파일 설정을 확인한 뒤 RTR 최적화 컨트롤을 열어 드립니다.',
            profileFallbackBody: 'RTR 프로파일을 아직 불러오지 못해 기준선 비교 카드만 먼저 제공합니다.',
            energyUnit: 'kWh/m²/일',
            waitingTarget: '현재 RTR 상태에서 예측 마디 전개를 아직 계산하지 못했습니다. 목표 마디 전개를 직접 입력하면 다시 계산합니다.',
        }
        : {
            title: 'RTR optimizer',
            subtitle: `Minimum sufficient temperature for ${getCropLabel(crop, locale)} node progression`,
            targetNode: 'Target node rate',
            predictedNode: 'Predicted node rate',
            recommendedMeanTemp: 'Recommended mean temp',
            deltaTemp: 'ΔT vs baseline',
            rtrEquivalent: 'Optimized RTR equivalent',
            confidence: 'Confidence',
            gainLoss: 'Gain/loss trade-off',
            cropInsight: 'Crop-specific insight',
            setpoints: 'Setpoint result',
            scenarios: 'Scenario compare',
            baselineCard: 'Baseline comparison card',
            refresh: 'Refresh',
            includeEnergy: 'Include energy cost',
            includeLabor: 'Include labor load',
            dayMin: 'Day minimum',
            nightMin: 'Night minimum',
            ventBias: 'Vent bias',
            screenBias: 'Screen bias',
            carbonMargin: 'Carbon margin',
            assimilationGain: 'Assimilation gain',
            respirationCost: 'Respiration cost',
            energyCost: 'Energy cost',
            laborCost: 'Labor load',
            targetHit: 'Target hit',
            yes: 'Hit',
            no: 'Guarded',
            sensitivity: 'Temperature sensitivity',
            noScenario: 'Scenario results are not available yet.',
            computing: 'Computing RTR optimizer...',
            modeHeader: 'Mode',
            meanHeader: 'Tmean',
            nodeHeader: 'Node/day',
            carbonHeader: 'Carbon',
            respHeader: 'Resp',
            energyHeader: 'Energy',
            laborHeader: 'Labor',
            disabledTitle: 'Baseline RTR monitor',
            disabledBody: 'This profile keeps the optimizer disabled, so only the baseline RTR monitor is shown.',
            profileLoadingTitle: 'RTR profile loading',
            profileLoadingBody: 'RTR optimization controls will open after the profile contract is confirmed.',
            profileFallbackBody: 'RTR profile data is unavailable, so the panel is staying on the baseline comparison card.',
            energyUnit: 'kWh/m²/day',
            waitingTarget: 'Predicted node progression is not available yet. Enter the target node rate manually to run the optimizer.',
        };

    const explanationCopy = useMemo(() => {
        const payload = optimizeResponse?.explanation_payload;
        const insight = optimizeResponse?.crop_specific_insight ?? null;
        if (!payload) {
            return null;
        }
        if (locale === 'ko') {
            return payload;
        }

        const deltaTemp = optimizeResponse?.rtr_equivalent.delta_temp_C ?? 0;
        const direction = deltaTemp >= 0 ? 'raised' : 'lowered';
        const roundedDelta = formatNumber(Math.abs(deltaTemp), 2, locale);
        let cropSummary = payload.crop_summary;

        if (insight?.crop === 'cucumber') {
            const bottleneck = insight.bottleneck_layer ?? 'bottom';
            cropSummary = `The ${bottleneck} canopy layer is the main bottleneck, and ${formatNumber(insight.remaining_leaves ?? null, 0, locale)} remaining leaves are carrying current source capacity.`;
        } else if (insight?.crop === 'tomato') {
            cropSummary = `Active truss load and dominant sink cohort ${insight?.dominant_cohort_id ?? '-'} are driving the current tomato pressure.`;
        }

        return {
            ...payload,
            summary: `The optimizer ${direction} mean temperature by ${roundedDelta}°C to protect the node target near ${formatNumber(payload.target_node_development_per_day, 2, locale)} node/day.`,
            crop_summary: cropSummary,
            missing_work_event_warning: payload.missing_work_event_warning
                ? insight?.crop === 'cucumber'
                    ? 'Recent leaf-removal history is missing, so source-loss interpretation is less certain.'
                    : 'Recent fruit-thinning history is missing, so sink-load interpretation is less certain.'
                : null,
        };
    }, [locale, optimizeResponse]);

    useEffect(() => {
        const serverAreaMeta =
            stateResponse?.area_unit_meta
            ?? scenarioResponse?.area_unit_meta
            ?? sensitivityResponse?.area_unit_meta
            ?? (
                optimizeResponse
                    ? {
                        greenhouse_area_m2: optimizeResponse.units_m2.greenhouse_area_m2,
                        actual_area_m2: optimizeResponse.actual_area_projection.actual_area_m2,
                        actual_area_pyeong: optimizeResponse.actual_area_projection.actual_area_pyeong,
                    }
                    : null
            );

        if (serverAreaMeta) {
            syncAreaMeta(crop, serverAreaMeta);
        }
    }, [crop, optimizeResponse, scenarioResponse, sensitivityResponse, stateResponse, syncAreaMeta]);

    const sensitivityRows = useMemo(() => {
        const rows = sensitivityResponse?.sensitivities ?? [];
        const maxElasticity = Math.max(1, ...rows.map((row) => Math.abs(row.elasticity)));

        return rows.map((row) => ({
            ...row,
            widthPct: Math.max(8, (Math.abs(row.elasticity) / maxElasticity) * 100),
        }));
    }, [sensitivityResponse]);

    const warningBadges = optimizeResponse?.warning_badges ?? [];
    const scenarioRows = scenarioResponse?.scenarios ?? [];
    const targetHit = optimizeResponse?.feasibility.target_node_hit ?? false;
    const confidence = optimizeResponse?.feasibility.confidence ?? null;
    const waitingForTarget = !loadingState && targetNodeDevelopmentPerDay === null;

    if (isProfilePending) {
        return (
            <div className={`flex h-full flex-col rounded-xl border border-slate-100 bg-white shadow-sm ${compact ? 'p-3' : 'p-5'}`}>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                    <p className="font-semibold text-slate-900">{copy.profileLoadingTitle}</p>
                    <p className="mt-1">{copy.profileLoadingBody}</p>
                </div>
            </div>
        );
    }

    if (isProfileUnavailable || !optimizerEnabled) {
        return (
            <div className={`flex h-full flex-col rounded-xl border border-slate-100 bg-white shadow-sm ${compact ? 'p-3' : 'p-5'}`}>
                {profileError ? (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                        {profileError}
                    </div>
                ) : null}
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                    <p className="font-semibold text-slate-900">{copy.disabledTitle}</p>
                    <p className="mt-1">{isProfileUnavailable ? copy.profileFallbackBody : copy.disabledBody}</p>
                </div>
                <RTROutlookPanel
                    crop={crop}
                    currentData={currentData}
                    history={history}
                    temperatureSettings={temperatureSettings}
                    weather={weather}
                    loading={loading}
                    error={error}
                    profile={profile}
                    profileLoading={profileLoading}
                    profileError={profileError}
                    compact={compact}
                />
            </div>
        );
    }

    return (
        <div className={`flex h-full flex-col rounded-xl border border-slate-100 bg-white shadow-sm ${compact ? 'p-3' : 'p-5'}`}>
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-slate-800">
                        <CircleGauge className="h-5 w-5 text-emerald-600" />
                        <h3 className={compact ? 'text-sm font-semibold' : 'font-semibold'}>{copy.title}</h3>
                    </div>
                    {!compact ? (
                        <p className="mt-1 text-xs text-slate-500">{copy.subtitle}</p>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={() => void refreshOptimization()}
                    disabled={loadingState || loadingOptimize || optimizerLoading || waitingForTarget}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                    {copy.refresh}
                </button>
            </div>
            <div className="space-y-4">
                {optimizerError ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                        {optimizerError}
                    </div>
                ) : null}
                {waitingForTarget ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
                        {copy.waitingTarget}
                    </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label className="rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-600">
                        <span>{copy.targetNode}</span>
                        <input
                            aria-label={copy.targetNode}
                            inputMode="decimal"
                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            value={targetNodeDevelopmentPerDay ?? ''}
                            onChange={(event) => {
                                const parsed = Number(event.target.value);
                                setTargetNodeDevelopmentPerDay(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
                            }}
                        />
                    </label>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500">{copy.predictedNode}</div>
                        <div className="mt-1 text-xl font-semibold text-slate-900">
                            {formatNumber(stateResponse?.canonical_state.growth.predicted_node_rate_day, 3, locale)}
                        </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500">{copy.recommendedMeanTemp}</div>
                        <div className="mt-1 text-xl font-semibold text-slate-900">
                            {formatNumber(optimizeResponse?.optimal_targets.mean_temp_C, 1, locale)}°C
                        </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500">{copy.deltaTemp}</div>
                        <div className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
                            {(optimizeResponse?.rtr_equivalent.delta_temp_C ?? 0) >= 0 ? (
                                <ArrowUpRight className="h-4 w-4 text-rose-600" />
                            ) : (
                                <ArrowDownRight className="h-4 w-4 text-sky-600" />
                            )}
                            {formatNumber(optimizeResponse?.rtr_equivalent.delta_temp_C, 2, locale)}°C
                        </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500">{copy.rtrEquivalent}</div>
                        <div className="mt-1 text-xl font-semibold text-slate-900">
                            {formatNumber(optimizeResponse?.rtr_equivalent.optimized_ratio, 3, locale)}
                        </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500">{copy.confidence}</div>
                        <div className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
                            {targetHit ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <BadgeAlert className="h-4 w-4 text-amber-600" />}
                            {formatNumber(confidence === null ? null : confidence * 100, 0, locale)}%
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {MODE_ORDER.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setOptimizationMode(mode)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                optimizationMode === mode
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {getModeLabel(mode, locale)}
                        </button>
                    ))}
                    <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
                        <input
                            type="checkbox"
                            checked={includeEnergyCost}
                            onChange={(event) => setIncludeEnergyCost(event.target.checked)}
                        />
                        {copy.includeEnergy}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                            type="checkbox"
                            checked={includeLaborCost}
                            onChange={(event) => setIncludeLaborCost(event.target.checked)}
                        />
                        {copy.includeLabor}
                    </label>
                </div>

                {warningBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {warningBadges.map((badge) => (
                            <span
                                key={badge}
                                className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium text-amber-800"
                            >
                                {getWarningLabel(badge, locale)}
                            </span>
                        ))}
                    </div>
                ) : null}

                <AreaUnitPanel
                    crop={crop}
                    canonicalAreaM2={areaState.canonicalAreaM2}
                    actualAreaM2={areaState.actualAreaM2}
                    actualAreaPyeong={areaState.actualAreaPyeong}
                    projection={optimizeResponse?.actual_area_projection ?? null}
                    onActualAreaM2Change={(value) => setActualAreaM2(crop, value)}
                    onActualAreaPyeongChange={(value) => setActualAreaPyeong(crop, value)}
                />

                <section className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-600" />
                        <h4 className="text-sm font-semibold text-slate-900">{copy.gainLoss}</h4>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.assimilationGain}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(optimizeResponse?.objective_breakdown.assimilation_gain, 3, locale)}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.respirationCost}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(optimizeResponse?.objective_breakdown.respiration_cost, 3, locale)}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.carbonMargin}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{optimizeResponse?.feasibility.carbon_margin_positive ? copy.yes : copy.no}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.energyCost}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(optimizeResponse?.objective_breakdown.energy_cost, 3, locale)} {copy.energyUnit}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.laborCost}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(optimizeResponse?.objective_breakdown.labor_index, 3, locale)}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.targetHit}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{targetHit ? copy.yes : copy.no}</div>
                        </div>
                    </div>
                    {explanationCopy ? (
                        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-3 text-sm leading-6 text-slate-700">
                            <p className="font-medium text-slate-900">{explanationCopy.summary}</p>
                            <p className="mt-2">{explanationCopy.crop_summary}</p>
                            {explanationCopy.reason_tags.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {explanationCopy.reason_tags.map((tag) => (
                                        <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                                            {getReasonTagLabel(tag, locale)}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            {explanationCopy.missing_work_event_warning ? (
                                <p className="mt-3 text-xs text-amber-700">{explanationCopy.missing_work_event_warning}</p>
                            ) : null}
                        </div>
                    ) : null}
                </section>

                <section className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-emerald-600" />
                        <h4 className="text-sm font-semibold text-slate-900">{copy.cropInsight}</h4>
                    </div>
                    {renderCropSpecificInsight(optimizeResponse?.crop_specific_insight ?? null, locale)}
                </section>
                <section className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-emerald-600" />
                        <h4 className="text-sm font-semibold text-slate-900">{copy.setpoints}</h4>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.dayMin}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(optimizeResponse?.optimal_targets.day_min_temp_C, 1, locale)}°C</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.nightMin}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(optimizeResponse?.optimal_targets.night_min_temp_C, 1, locale)}°C</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.ventBias}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(optimizeResponse?.optimal_targets.vent_bias_C, 2, locale)}°C</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">{copy.screenBias}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(optimizeResponse?.optimal_targets.screen_bias_pct, 1, locale)}%</div>
                        </div>
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-emerald-600" />
                        <h4 className="text-sm font-semibold text-slate-900">{copy.sensitivity}</h4>
                    </div>
                    <div className="space-y-3">
                        {sensitivityRows.map((row) => (
                            <div key={`${row.control}-${row.target}`}>
                                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                                    <span>{getSensitivityControlLabel(row.control, locale)} → {getSensitivityTargetLabel(row.target, locale)}</span>
                                    <span>{formatNumber(row.elasticity, 2, locale)}</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100">
                                    <div
                                        className={`h-2 rounded-full ${row.direction === 'increase' ? 'bg-emerald-500' : 'bg-sky-500'}`}
                                        style={{ width: `${row.widthPct}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <CircleGauge className="h-4 w-4 text-emerald-600" />
                        <h4 className="text-sm font-semibold text-slate-900">{copy.scenarios}</h4>
                    </div>
                    {scenarioRows.length === 0 ? (
                        <p className="text-sm text-slate-500">{copy.noScenario}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs text-slate-600">
                                <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                                    <tr>
                                        <th className="px-2 py-2">{copy.modeHeader}</th>
                                        <th className="px-2 py-2">{copy.meanHeader}</th>
                                        <th className="px-2 py-2">{copy.nodeHeader}</th>
                                        <th className="px-2 py-2">{copy.carbonHeader}</th>
                                        <th className="px-2 py-2">{copy.respHeader}</th>
                                        <th className="px-2 py-2">{copy.energyHeader}</th>
                                        <th className="px-2 py-2">{copy.laborHeader}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scenarioRows.map((row) => (
                                        <tr key={`${row.label}-${row.mode}`} className="border-t border-slate-100">
                                            <td className="px-2 py-2 font-medium text-slate-900">
                                                {getScenarioLabel(row.label, locale)}
                                            </td>
                                            <td className="px-2 py-2">{formatNumber(row.mean_temp_C, 1, locale)}°C</td>
                                            <td className="px-2 py-2">{formatNumber(row.node_rate_day, 3, locale)}</td>
                                            <td className="px-2 py-2">{formatNumber(row.net_carbon, 3, locale)}</td>
                                            <td className="px-2 py-2">{formatNumber(row.respiration, 3, locale)}</td>
                                            <td className="px-2 py-2">{formatNumber(row.energy_kwh_m2_day, 3, locale)}</td>
                                            <td className="px-2 py-2">{formatNumber(row.labor_index, 3, locale)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <details className="rounded-xl border border-slate-200 p-3">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                        {copy.baselineCard}
                    </summary>
                    <div className="mt-3">
                        <RTROutlookPanel
                            crop={crop}
                            currentData={currentData}
                            history={history}
                            temperatureSettings={temperatureSettings}
                            weather={weather}
                            loading={loading}
                            error={error}
                            profile={profile}
                            profileLoading={profileLoading}
                            profileError={profileError}
                            compact
                        />
                    </div>
                </details>

                {(optimizerLoading || loading) ? (
                    <div className="text-xs text-slate-500">{copy.computing}</div>
                ) : null}
            </div>
        </div>
    );
};

export default RTROptimizerPanel;
