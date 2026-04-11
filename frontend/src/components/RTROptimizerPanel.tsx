import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
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
    TelemetryStatus,
    WeatherOutlook,
} from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { getReadinessDescriptor } from '../lib/design/readiness';
import { getCropLabel } from '../utils/displayCopy';
import { getRequestErrorCopy } from '../utils/requestErrorCopy';
import { useAreaUnit } from '../context/AreaUnitContext';
import { useRtrOptimizer } from '../hooks/useRtrOptimizer';
import AreaUnitPanel from './AreaUnitPanel';
import RTROutlookPanel from './RTROutlookPanel';

interface RTROptimizerPanelProps {
    crop: CropType;
    currentData: SensorData;
    history: SensorData[];
    telemetryStatus?: TelemetryStatus;
    temperatureSettings: TemperatureSettings;
    weather: WeatherOutlook | null;
    loading: boolean;
    error: string | null;
    profile: RtrProfile | null;
    profileLoading: boolean;
    profileError: string | null;
    optimizerEnabled?: boolean;
    defaultMode?: RtrOptimizationMode;
    onRefreshProfiles?: () => void | Promise<void>;
    compact?: boolean;
    optimizerState?: RTROptimizerStateLike;
    uiState?: RTROptimizerUiStateLike;
}

export interface RTROptimizerStateLike {
    stateResponse: ReturnType<typeof useRtrOptimizer>['stateResponse'];
    optimizeResponse: ReturnType<typeof useRtrOptimizer>['optimizeResponse'];
    scenarioResponse: ReturnType<typeof useRtrOptimizer>['scenarioResponse'];
    sensitivityResponse: ReturnType<typeof useRtrOptimizer>['sensitivityResponse'];
    targetNodeDevelopmentPerDay: ReturnType<typeof useRtrOptimizer>['targetNodeDevelopmentPerDay'];
    setTargetNodeDevelopmentPerDay: ReturnType<typeof useRtrOptimizer>['setTargetNodeDevelopmentPerDay'];
    optimizationMode: ReturnType<typeof useRtrOptimizer>['optimizationMode'];
    setOptimizationMode: ReturnType<typeof useRtrOptimizer>['setOptimizationMode'];
    customScenario: ReturnType<typeof useRtrOptimizer>['customScenario'];
    setCustomScenario: ReturnType<typeof useRtrOptimizer>['setCustomScenario'];
    includeEnergyCost: ReturnType<typeof useRtrOptimizer>['includeEnergyCost'];
    setIncludeEnergyCost: ReturnType<typeof useRtrOptimizer>['setIncludeEnergyCost'];
    includeCoolingCost: ReturnType<typeof useRtrOptimizer>['includeCoolingCost'];
    setIncludeCoolingCost: ReturnType<typeof useRtrOptimizer>['setIncludeCoolingCost'];
    includeLaborCost: ReturnType<typeof useRtrOptimizer>['includeLaborCost'];
    setIncludeLaborCost: ReturnType<typeof useRtrOptimizer>['setIncludeLaborCost'];
    telemetryOptimizationBlocked: ReturnType<typeof useRtrOptimizer>['telemetryOptimizationBlocked'];
    loading: ReturnType<typeof useRtrOptimizer>['loading'];
    loadingState: ReturnType<typeof useRtrOptimizer>['loadingState'];
    loadingOptimize: ReturnType<typeof useRtrOptimizer>['loadingOptimize'];
    error: ReturnType<typeof useRtrOptimizer>['error'];
    refreshState: ReturnType<typeof useRtrOptimizer>['refreshState'];
    refreshOptimization: ReturnType<typeof useRtrOptimizer>['refreshOptimization'];
}

export interface RTROptimizerCustomScenarioDraft {
    label: string;
    dayHeatingMinTempC: string;
    nightHeatingMinTempC: string;
    dayCoolingTargetC: string;
    nightCoolingTargetC: string;
    ventBiasC: string;
    screenBiasPct: string;
    circulationFanPct: string;
    co2TargetPpm: string;
}

export interface RTROptimizerUiStateLike {
    customScenarioDraft: RTROptimizerCustomScenarioDraft;
    setCustomScenarioDraft: Dispatch<SetStateAction<RTROptimizerCustomScenarioDraft>>;
    targetNodeInputValue: string;
    setTargetNodeInputValue: Dispatch<SetStateAction<string>>;
    isTargetNodeInputActive: boolean;
    setIsTargetNodeInputActive: Dispatch<SetStateAction<boolean>>;
}

interface RTROptimizerPanelContentProps extends Omit<RTROptimizerPanelProps, 'optimizerState' | 'uiState'> {
    optimizerState: RTROptimizerStateLike;
    uiState?: RTROptimizerUiStateLike;
}

const MODE_ORDER: RtrOptimizationMode[] = [
    'balanced',
    'yield_priority',
    'energy_priority',
    'labor_priority',
    'cooling_saving',
    'heating_saving',
];
const DEFAULT_OPTIMIZATION_MODE: RtrOptimizationMode = 'balanced';
const sectionPanelClass = 'sg-warm-panel border border-[color:var(--sg-outline-soft)] p-4';
const metricTileClass = 'sg-warm-subpanel p-3';
const metricLabelClass = 'text-[11px] text-[color:var(--sg-text-muted)]';
const metricValueClass = 'mt-1 text-lg font-semibold text-[color:var(--sg-text-strong)]';
const metricValueLargeClass = 'mt-1 text-xl font-semibold text-[color:var(--sg-text-strong)]';
const metricMetaClass = 'mt-1 text-[11px] text-[color:var(--sg-text-muted)]';
const DECIMAL_INPUT_PATTERN = /^\d*(?:[.,]\d*)?$/;
const RTRCalibrationWorkspace = lazy(() => import('./RTRCalibrationWorkspace'));

function createEmptyCustomScenarioDraft(): RTROptimizerCustomScenarioDraft {
    return {
        label: '',
        dayHeatingMinTempC: '',
        nightHeatingMinTempC: '',
        dayCoolingTargetC: '',
        nightCoolingTargetC: '',
        ventBiasC: '',
        screenBiasPct: '',
        circulationFanPct: '',
        co2TargetPpm: '',
    };
}

function formatDraftNumber(value: number | undefined): string {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function buildCustomScenarioDraft(
    customScenario: RTROptimizerStateLike['customScenario'],
    fallbackLabel: string,
): RTROptimizerCustomScenarioDraft {
    if (!customScenario) {
        return createEmptyCustomScenarioDraft();
    }
    return {
        label: customScenario.label === fallbackLabel ? '' : customScenario.label,
        dayHeatingMinTempC: formatDraftNumber(customScenario.day_heating_min_temp_C),
        nightHeatingMinTempC: formatDraftNumber(customScenario.night_heating_min_temp_C),
        dayCoolingTargetC: formatDraftNumber(customScenario.day_cooling_target_C),
        nightCoolingTargetC: formatDraftNumber(customScenario.night_cooling_target_C),
        ventBiasC: formatDraftNumber(customScenario.vent_bias_C),
        screenBiasPct: formatDraftNumber(customScenario.screen_bias_pct),
        circulationFanPct: formatDraftNumber(customScenario.circulation_fan_pct),
        co2TargetPpm: formatDraftNumber(customScenario.co2_target_ppm),
    };
}

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
        if (mode === 'yield_priority' || mode === 'growth_priority') return '수량 우선';
        if (mode === 'energy_priority' || mode === 'energy_saving') return '에너지 우선';
        if (mode === 'labor_priority' || mode === 'labor_saving') return '노동 우선';
        if (mode === 'cooling_saving') return '냉방 절감';
        if (mode === 'heating_saving') return '난방 절감';
        if (mode === 'growth_priority') return '생장 우선';
        if (mode === 'energy_saving') return '에너지 절감';
        if (mode === 'labor_saving') return '작업 절감';
        if (mode === 'custom_weights') return '사용자 가중치';
        if (mode === 'baseline') return '평소 설정';
        return '균형';
    }

    if (mode === 'yield_priority' || mode === 'growth_priority') return 'Yield';
    if (mode === 'energy_priority' || mode === 'energy_saving') return 'Energy';
    if (mode === 'labor_priority' || mode === 'labor_saving') return 'Labor';
    if (mode === 'cooling_saving') return 'Cooling save';
    if (mode === 'heating_saving') return 'Heating save';
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
        'yield_priority',
        'energy_priority',
        'labor_priority',
        'cooling_saving',
        'heating_saving',
        'custom_weights',
        'baseline',
        'offset_minus_0_3c',
        'offset_plus_0_3c',
        'offset_plus_0_6c',
        'heating_weaker',
        'heating_stronger',
        'cooling_weaker',
        'cooling_stronger',
        'vent_more_open',
        'vent_more_closed',
        'screen_more_open',
        'screen_more_closed',
        'coordinated_hvac',
        'optimizer_chosen',
    ]);

    if (label === 'offset_minus_0_3c') {
        return locale === 'ko' ? '평소 설정 -0.3°C' : 'Baseline -0.3°C';
    }
    if (label === 'offset_plus_0_3c') {
        return locale === 'ko' ? '평소 설정 +0.3°C' : 'Baseline +0.3°C';
    }
    if (label === 'offset_plus_0_6c') {
        return locale === 'ko' ? '평소 설정 +0.6°C' : 'Baseline +0.6°C';
    }
    if (label === 'heating_weaker') {
        return locale === 'ko' ? '난방 약화' : 'Heating weaker';
    }
    if (label === 'heating_stronger') {
        return locale === 'ko' ? '난방 강화' : 'Heating stronger';
    }
    if (label === 'cooling_weaker') {
        return locale === 'ko' ? '냉방 약화' : 'Cooling weaker';
    }
    if (label === 'cooling_stronger') {
        return locale === 'ko' ? '냉방 강화' : 'Cooling stronger';
    }
    if (label === 'vent_more_open') {
        return locale === 'ko' ? '환기 더 열기' : 'Vent more open';
    }
    if (label === 'vent_more_closed') {
        return locale === 'ko' ? '환기 더 닫기' : 'Vent more closed';
    }
    if (label === 'screen_more_open') {
        return locale === 'ko' ? '스크린 더 열기' : 'Screen more open';
    }
    if (label === 'screen_more_closed') {
        return locale === 'ko' ? '스크린 더 닫기' : 'Screen more closed';
    }
    if (label === 'coordinated_hvac') {
        return locale === 'ko' ? '냉난방 연동' : 'Coordinated HVAC';
    }
    if (label === 'optimizer_chosen') {
        return locale === 'ko' ? '권장 제어안' : 'Recommended control';
    }

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
        'temperature-up': '평소 설정보다 온도 상향',
        'temperature-down': '평소 설정보다 온도 하향',
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

function getSensitivityControlLabel(code: string, locale: 'en' | 'ko', crop?: CropType): string {
    const koMap: Record<string, string> = {
        day_heating_min_temp_C: '주간 난방 기준',
        night_heating_min_temp_C: '야간 난방 기준',
        day_cooling_target_C: '주간 냉방 기준',
        night_cooling_target_C: '야간 냉방 기준',
        vent_bias_C: '환기 편차',
        screen_bias_pct: '스크린 편차',
        circulation_fan_pct: '순환팬 강도',
        co2_target_ppm: 'CO₂ 목표',
        target_node_rate_day: '목표 마디 전개',
        temperature_day: '주간 온도',
        temperature_night: '야간 온도',
        temperature_mean: '평균 온도',
        screen_bias: '스크린 편차',
    };
    const enMap: Record<string, string> = {
        day_heating_min_temp_C: 'Day heating minimum',
        night_heating_min_temp_C: 'Night heating minimum',
        day_cooling_target_C: 'Day cooling target',
        night_cooling_target_C: 'Night cooling target',
        vent_bias_C: 'Vent bias',
        screen_bias_pct: 'Screen bias',
        circulation_fan_pct: 'Circulation fan',
        co2_target_ppm: 'CO2 target',
        target_node_rate_day: 'Target node rate',
        temperature_day: 'Day temperature',
        temperature_night: 'Night temperature',
        temperature_mean: 'Mean temperature',
        screen_bias: 'Screen bias',
    };

    if (locale === 'ko' && crop === 'Tomato' && code === 'target_node_rate_day') {
        return '목표 화방 전개';
    }
    return (locale === 'ko' ? koMap[code] : enMap[code]) ?? code;
}

function getSensitivityTargetLabel(code: string, locale: 'en' | 'ko', crop?: CropType): string {
    const koMap: Record<string, string> = {
        objective: '목적함수',
        predicted_node_rate_day: '예측 마디 전개',
        carbon_margin: '탄소 마진',
        energy_cost: '총 에너지 비용',
        heating_energy_cost: '난방 에너지 비용',
        cooling_energy_cost: '냉방 에너지 비용',
        labor_penalty: '노동 패널티',
        humidity_penalty: '습도 위험 패널티',
        humidity_risk_penalty: '습도 위험 패널티',
        disease_penalty: '병해 위험 패널티',
    };
    const enMap: Record<string, string> = {
        objective: 'Objective',
        predicted_node_rate_day: 'Predicted node rate',
        carbon_margin: 'Carbon margin',
        energy_cost: 'Total energy cost',
        heating_energy_cost: 'Heating energy cost',
        cooling_energy_cost: 'Cooling energy cost',
        labor_penalty: 'Labor penalty',
        humidity_penalty: 'Humidity risk penalty',
        humidity_risk_penalty: 'Humidity risk penalty',
        disease_penalty: 'Disease penalty',
    };

    if (locale === 'ko' && crop === 'Tomato' && code === 'predicted_node_rate_day') {
        return '예측 화방 전개';
    }
    return (locale === 'ko' ? koMap[code] : enMap[code]) ?? code;
}

function getScenarioGroupLabel(group: string, locale: 'en' | 'ko'): string {
    const koMap: Record<string, string> = {
        baseline: '평소 설정 비교',
        hvac: '냉난방 비교',
        'vent-screen': '환기·스크린 비교',
        optimizer: '권장 제어안',
    };
    const enMap: Record<string, string> = {
        baseline: 'Baseline rows',
        hvac: 'HVAC rows',
        'vent-screen': 'Vent/screen rows',
        optimizer: 'Recommended control',
    };
    return (locale === 'ko' ? koMap[group] : enMap[group]) ?? group;
}

function getRiskSeverityClass(severity: string): string {
    if (severity === 'high') {
        return 'border-[color:var(--sg-accent-rose)]/20 bg-[color:var(--sg-status-offline-bg)] text-[color:var(--sg-status-offline-text)]';
    }
    if (severity === 'medium') {
        return 'border-[color:var(--sg-accent-amber)]/20 bg-[color:var(--sg-status-delayed-bg)] text-[color:var(--sg-status-delayed-text)]';
    }
    return 'border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]';
}

function getRiskFlagTitle(code: string, locale: 'en' | 'ko'): string {
    const koMap: Record<string, string> = {
        trust_region_exceeded: '신뢰 구간 초과',
        disease_risk_high: '습도 병해 위험',
        screen_humidity_coupling: '스크린-습도 결합 위험',
        heat_stress_risk: '고온 스트레스 위험',
        cold_stress_risk: '저온 스트레스 위험',
        night_cold_risk: '야간 저온 위험',
        source_loss_risk: '광원 부족 위험',
    };
    const enMap: Record<string, string> = {
        trust_region_exceeded: 'Trust region exceeded',
        disease_risk_high: 'Disease-risk humidity',
        screen_humidity_coupling: 'Screen humidity coupling',
        heat_stress_risk: 'Heat stress risk',
        cold_stress_risk: 'Cold stress risk',
        night_cold_risk: 'Night cold risk',
        source_loss_risk: 'Source loss risk',
    };

    return (locale === 'ko' ? koMap[code] : enMap[code]) ?? code;
}

function getRiskFlagMessage(
    riskFlag: Record<string, unknown>,
    locale: 'en' | 'ko',
): string {
    const code = String(riskFlag.code ?? '');
    const control = riskFlag.control ? ` (${String(riskFlag.control)})` : '';
    const koMap: Record<string, string> = {
        trust_region_exceeded: `현재 제어안이 신뢰 가능한 변경 폭을 벗어났습니다${control}.`,
        disease_risk_high: '목표 습도가 병해 위험 상한에 가까워 추가 보수 운전이 필요합니다.',
        screen_humidity_coupling: '스크린과 습도 상승이 함께 작동해 하위 군락 습도 위험이 커집니다.',
        heat_stress_risk: '주간 목표온도가 작물 스트레스 상한에 가까워 추가 상향을 제한했습니다.',
        cold_stress_risk: '주간 목표온도가 회복 가능 구간 아래로 내려가 더 낮추지 않았습니다.',
        night_cold_risk: '야간 목표온도가 안전 하한에 가까워 추가 하향을 제한했습니다.',
        source_loss_risk: '현재 source 부족 상태에서 추가 스크린 닫힘이 더 불리해집니다.',
    };
    const fallback = typeof riskFlag.message === 'string' ? riskFlag.message : '-';
    return locale === 'ko' ? (koMap[code] ?? fallback) : fallback;
}

function shouldHideRiskFlagCode(code: string): boolean {
    return code === 'trust_region_exceeded';
}

function shouldHideRiskFlag(riskFlag: Record<string, unknown>): boolean {
    return shouldHideRiskFlagCode(String(riskFlag.code ?? ''));
}

function getTelemetryWarningCopy(status: TelemetryStatus, locale: 'en' | 'ko'): string | null {
    if (status === 'stale') {
        return locale === 'ko'
            ? '센서 수신이 오래되어 새 계산은 보수적으로 봐야 합니다. 최신 측정이 들어오면 다시 계산하세요.'
            : 'Sensor telemetry is stale, so treat new calculations conservatively until a fresh snapshot arrives.';
    }
    if (status === 'delayed') {
        return locale === 'ko'
            ? '센서 수신이 지연되고 있어 현재 추천은 보수적으로 해석하는 것이 좋습니다.'
            : 'Sensor telemetry is delayed, so interpret the current recommendation conservatively.';
    }
    if (status === 'offline') {
        return locale === 'ko'
            ? '센서가 오프라인 상태라 RTR 최적화는 마지막 유효 스냅샷 기준으로만 계산됩니다.'
            : 'Sensors are offline, so RTR optimization is running only on the last valid snapshot.';
    }
    return null;
}

function getScenarioBadgeLabel(value: string, locale: 'en' | 'ko'): string {
    const koMap: Record<string, string> = {
        baseline: '평소 설정',
        recommended: '권장',
        compare: '비교',
        custom: '사용자',
    };
    const enMap: Record<string, string> = {
        baseline: 'Baseline',
        recommended: 'Recommended',
        compare: 'Compare',
        custom: 'Custom',
    };
    return (locale === 'ko' ? koMap[value] : enMap[value]) ?? value;
}

function getScenarioBadgeClass(value: string): string {
    if (value === 'recommended') {
        return 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]';
    }
    if (value === 'baseline') {
        return 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]';
    }
    if (value === 'custom') {
        return 'bg-[color:var(--sg-accent-rose-soft)] text-[color:var(--sg-accent-rose)]';
    }
    return 'bg-[color:var(--sg-accent-earth-soft)] text-[color:var(--sg-accent-earth)]';
}

function getYieldTrendLabel(value: string, locale: 'en' | 'ko'): string {
    const koMap: Record<string, string> = {
        up: '수확 상승',
        stable: '수확 유지',
        guarded: '수확 방어',
    };
    const enMap: Record<string, string> = {
        up: 'Yield up',
        stable: 'Yield stable',
        guarded: 'Yield guarded',
    };
    return (locale === 'ko' ? koMap[value] : enMap[value]) ?? value;
}

function getYieldTrendClass(value: string): string {
    if (value === 'up') {
        return 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]';
    }
    if (value === 'guarded') {
        return 'bg-[color:var(--sg-status-delayed-bg)] text-[color:var(--sg-status-delayed-text)]';
    }
    return 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]';
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
                                    <div className={metricTileClass}>
                    <div className={metricLabelClass}>{locale === 'ko' ? '남은 엽수' : 'Remaining leaves'}</div>
                    <div className={metricValueClass}>{formatNumber(insight.remaining_leaves, 0, locale)}</div>
                </div>
                                    <div className={metricTileClass}>
                    <div className={metricLabelClass}>{locale === 'ko' ? '병목 엽층' : 'Bottleneck layer'}</div>
                    <div className="mt-1 text-lg font-semibold capitalize text-[color:var(--sg-text-strong)]">
                        {locale === 'ko'
                            ? insight.bottleneck_layer === 'upper'
                                ? '상위엽'
                                : insight.bottleneck_layer === 'middle'
                                    ? '중위엽'
                                    : '하위엽'
                            : insight.bottleneck_layer}
                    </div>
                </div>
                <div className={metricTileClass}>
                    <div className={metricLabelClass}>{locale === 'ko' ? '상/중/하 엽 활동도' : 'Layer activity'}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[color:var(--sg-text)]">
                        <span>{locale === 'ko' ? '상위엽' : 'Upper'} {formatNumber(insight.layer_activity.upper, 2, locale)}</span>
                        <span>{locale === 'ko' ? '중위엽' : 'Middle'} {formatNumber(insight.layer_activity.middle, 2, locale)}</span>
                        <span>{locale === 'ko' ? '하위엽' : 'Bottom'} {formatNumber(insight.layer_activity.bottom, 2, locale)}</span>
                    </div>
                </div>
                <div className={metricTileClass}>
                    <div className={metricLabelClass}>{locale === 'ko' ? '최근 적엽 이벤트' : 'Recent leaf-removal events'}</div>
                    <div className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                        {formatNumber(insight.recent_leaf_removal_count, 0, locale)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-3 md:grid-cols-2">
                                    <div className={metricTileClass}>
                <div className={metricLabelClass}>{locale === 'ko' ? '활성 화방' : 'Active trusses'}</div>
                <div className={metricValueClass}>{formatNumber(insight.active_trusses, 0, locale)}</div>
            </div>
                                    <div className={metricTileClass}>
                <div className={metricLabelClass}>{locale === 'ko' ? '과실 분배비' : 'Fruit partition ratio'}</div>
                <div className={metricValueClass}>{formatNumber(insight.fruit_partition_ratio, 2, locale)}</div>
            </div>
            <div className={metricTileClass}>
                <div className={metricLabelClass}>{locale === 'ko' ? '주요 sink cohort' : 'Dominant cohort'}</div>
                <div className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                    {insight.dominant_cohort_id ?? '-'} / {formatNumber(insight.dominant_cohort_sink, 2, locale)}
                </div>
            </div>
            <div className={metricTileClass}>
                <div className={metricLabelClass}>{locale === 'ko' ? '최근 적과 이벤트' : 'Recent thinning events'}</div>
                <div className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                    {formatNumber(insight.recent_fruit_thinning_count, 0, locale)}
                </div>
            </div>
        </div>
    );
}

const RTROptimizerPanelContent = ({
    crop,
    currentData,
    history,
    telemetryStatus = 'live',
    temperatureSettings,
    weather,
    loading,
    error,
    profile,
    profileLoading,
    profileError,
    optimizerEnabled: optimizerEnabledProp,
    onRefreshProfiles,
    compact = false,
    optimizerState,
    uiState,
}: RTROptimizerPanelContentProps) => {
    const { locale } = useLocale();
    const { areaByCrop, setActualAreaM2, setActualAreaPyeong, syncAreaMeta } = useAreaUnit();
    const areaState = areaByCrop[crop];
    const defaultCustomLabel = locale === 'ko' ? '사용자 비교' : 'Custom compare';
    const optimizerEnabled = profileLoading ? false : (profile?.optimizer?.enabled ?? optimizerEnabledProp ?? false);
    const {
        stateResponse,
        optimizeResponse,
        scenarioResponse,
        sensitivityResponse,
        targetNodeDevelopmentPerDay,
        setTargetNodeDevelopmentPerDay,
        optimizationMode,
        setOptimizationMode,
        customScenario,
        setCustomScenario,
        includeEnergyCost,
        setIncludeEnergyCost,
        includeCoolingCost,
        setIncludeCoolingCost,
        includeLaborCost,
        setIncludeLaborCost,
        telemetryOptimizationBlocked,
        loading: optimizerLoading,
        loadingState,
        loadingOptimize,
        error: optimizerError,
        refreshState,
        refreshOptimization,
    } = optimizerState;
    const [localCustomScenarioDraft, setLocalCustomScenarioDraft] = useState<RTROptimizerCustomScenarioDraft>(() => (
        buildCustomScenarioDraft(customScenario, defaultCustomLabel)
    ));
    const [localTargetNodeInputValue, setLocalTargetNodeInputValue] = useState('');
    const [localIsTargetNodeInputActive, setLocalIsTargetNodeInputActive] = useState(false);
    const customScenarioDraft = uiState?.customScenarioDraft ?? localCustomScenarioDraft;
    const setCustomScenarioDraft = uiState?.setCustomScenarioDraft ?? setLocalCustomScenarioDraft;
    const targetNodeInputValue = uiState?.targetNodeInputValue ?? localTargetNodeInputValue;
    const setTargetNodeInputValue = uiState?.setTargetNodeInputValue ?? setLocalTargetNodeInputValue;
    const isTargetNodeInputActive = uiState?.isTargetNodeInputActive ?? localIsTargetNodeInputActive;
    const setIsTargetNodeInputActive = uiState?.setIsTargetNodeInputActive ?? setLocalIsTargetNodeInputActive;
    const isProfilePending = profileLoading && profile === null;
    const isProfileUnavailable = !profileLoading && profile === null;
    const defaultDevelopmentMetric = crop === 'Tomato' ? 'truss' : 'node';
    const developmentMetric = optimizeResponse?.explanation_payload?.development_metric ?? defaultDevelopmentMetric;
    const usesTrussProgress = developmentMetric === 'truss';
    const developmentDisplayScale = usesTrussProgress ? 3 : 1;
    const developmentLabelKo = usesTrussProgress ? '화방 진행' : '마디 전개';
    const developmentLabelEn = usesTrussProgress ? 'truss progression' : 'node progression';
    const developmentUnit = usesTrussProgress ? 'truss/day' : 'node/day';
    const developmentHeaderKo = usesTrussProgress ? '화방/일' : '마디/일';
    const toDisplayDevelopmentRate = useCallback((value: number | null | undefined): number | null => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return null;
        }
        return value / developmentDisplayScale;
    }, [developmentDisplayScale]);

    const syncedTargetNodeInputValue = useMemo(() => {
        const displayRate = toDisplayDevelopmentRate(targetNodeDevelopmentPerDay);
        if (displayRate === null) {
            return '';
        }
        return String(Number(displayRate.toFixed(3)));
    }, [targetNodeDevelopmentPerDay, toDisplayDevelopmentRate]);
    const targetNodeInputDisplayValue = isTargetNodeInputActive
        ? targetNodeInputValue
        : syncedTargetNodeInputValue;

    const handleTargetNodeInputChange = (rawValue: string) => {
        if (!DECIMAL_INPUT_PATTERN.test(rawValue)) {
            return;
        }

        setTargetNodeInputValue(rawValue);
        const normalized = rawValue.replace(',', '.');
        if (!normalized) {
            setTargetNodeDevelopmentPerDay(null);
            return;
        }
        if (normalized.endsWith('.')) {
            return;
        }

        const parsed = Number(normalized);
        setTargetNodeDevelopmentPerDay(
            Number.isFinite(parsed) && parsed > 0
                ? parsed * developmentDisplayScale
                : null,
        );
    };
    const handleTargetNodeInputFocus = () => {
        setTargetNodeInputValue(syncedTargetNodeInputValue);
        setIsTargetNodeInputActive(true);
    };
    const handleTargetNodeInputBlur = () => {
        setIsTargetNodeInputActive(false);
    };

    const refreshCalibrationConsumers = async () => {
        await Promise.resolve(onRefreshProfiles?.());
        await refreshState();
        await refreshOptimization();
    };
    const optimizerErrorCopy = getRequestErrorCopy(optimizerError, locale, {
        resourceKo: '환경 제어 추천',
        resourceEn: 'the control recommendation',
    });
    const profileErrorCopy = getRequestErrorCopy(profileError, locale, {
        resourceKo: '평소 온도 설정',
        resourceEn: 'the strategy line',
    });

    const copy = locale === 'ko'
        ? {
            title: '빛 맞춤 온도',
            subtitle: `${getCropLabel(crop, locale)} 오늘 제어안과 목표 ${developmentLabelKo}를 함께 봅니다`,
            targetNode: `목표 ${developmentLabelKo}`,
            targetNodeHint: usesTrussProgress
                ? `하루 화방 진행 목표 (${developmentUnit})`
                : `하루 목표 마디 (${developmentUnit})`,
            predictedNode: `현재 예측 ${developmentLabelKo}`,
            recommendedMeanTemp: '추천 최소 평균온도',
            deltaTemp: '평소 설정 대비 ΔT',
            rtrEquivalent: '최적 RTR 환산값',
            confidence: '반영 상태',
            nodeGuideTitle: `평균 온도별 예상 ${developmentLabelKo}`,
            nodeGuideRange: '유효 온도 범위',
            nodeGuideTemp: '평균 온도(°C)',
            nodeGuideNode: usesTrussProgress
                ? `예상 화방 진행(${developmentUnit})`
                : `예상 ${developmentLabelKo}(${developmentUnit})`,
            nodeGuideWaiting: '온도별 계산값을 표시할 수 없습니다.',
            gainLoss: '이득/손실 균형',
            cropInsight: '작물별 해석',
            setpoints: '추천 제어값',
            scenarios: '시나리오 비교',
            customScenarioTitle: '사용자 비교 시나리오',
            customScenarioBody: '난방·냉방·환기·스크린·팬·CO₂ 후보를 직접 넣어 평소 설정안과 권장안을 비교합니다.',
            customLabel: '비교 이름',
            customApply: '비교에 반영',
            customReset: '초기화',
            baselineCard: '평소 설정 비교 카드',
            refresh: '다시 계산',
            includeEnergy: '에너지 비용 포함',
            includeCooling: '냉방 비용 포함',
            includeLabor: '작업부하 포함',
            dayMin: '주간 최소 평균온도',
            nightMin: '야간 최소 평균온도',
            dayHeating: '주간 난방 기준',
            nightHeating: '야간 난방 기준',
            dayCooling: '주간 냉방 기준',
            nightCooling: '야간 냉방 기준',
            ventBias: '환기 편차',
            screenBias: '스크린 편차',
            circulationFan: '순환팬 강도',
            co2Target: 'CO₂ 목표',
            holdTime: '유지 시간',
            changeLimit: '변경 제한',
            carbonMargin: '탄소 마진',
            assimilationGain: '광합성 이득',
            respirationCost: '호흡 부담',
            sinkOverload: 'sink 과부하 위험',
            energyCost: '총 에너지 비용',
            heatingEnergy: '난방 에너지',
            coolingEnergy: '냉방 에너지',
            laborCost: '작업부하',
            yieldChange: '예상 수량 변화',
            humidityRisk: '습도 위험',
            diseaseRisk: '병해/결로 리스크',
            stressPenalty: '스트레스 패널티',
            controlEffects: '제어 후 미기상',
            targetHit: '목표 충족',
            yes: '충족',
            no: '보류',
            sensitivity: '제어 민감도',
            noScenario: '시나리오 계산 결과가 아직 없습니다.',
            computing: '빛 맞춤 온도를 계산하는 중...',
            modeHeader: '시나리오',
            meanHeader: '평균온도',
            nodeHeader: developmentHeaderKo,
            carbonHeader: '탄소/동화',
            riskHeader: '습도/병해',
            energyHeader: '냉난방 비용',
            yieldHeader: '수량 추세',
            laborHeader: '노동',
            telemetryBlockedTitle: '실시간 수신이 오래돼 새 계산을 잠시 멈췄습니다.',
            telemetryBlockedBody: '센서가 오래되었거나 끊기면 마지막 유효 스냅샷 기준 비교만 유지합니다.',
            disabledTitle: '평소 온도 설정 비교',
            disabledBody: '이 프로파일은 아직 자동 맞춤 계산을 켜지 않아 평소 설정 비교만 보여줍니다.',
            profileLoadingTitle: '빛 맞춤 설정 준비 중',
            profileLoadingBody: '프로파일 설정을 확인한 뒤 맞춤 제어 화면을 엽니다.',
            profileFallbackBody: '프로파일을 아직 불러오지 못해 평소 설정 비교 카드만 먼저 보여줍니다.',
            energyUnit: 'kWh/m²/일',
            waitingTarget: `현재 상태에서 예측 ${developmentLabelKo}를 아직 계산하지 못했습니다. 목표 ${developmentLabelKo}를 직접 입력하면 다시 계산합니다.`,
        }
        : {
            title: 'Light-linked temperature',
            subtitle: `Review today’s control lane and target ${developmentLabelEn} for ${getCropLabel(crop, locale)}`,
            targetNode: `Target ${developmentLabelEn}`,
            targetNodeHint: `Daily target (${developmentUnit})`,
            predictedNode: `Predicted ${developmentLabelEn}`,
            recommendedMeanTemp: 'Recommended minimum mean temp',
            deltaTemp: 'ΔT vs baseline',
            rtrEquivalent: 'Optimized RTR equivalent',
            confidence: 'Readiness',
            nodeGuideTitle: `${usesTrussProgress ? 'Truss' : 'Node'} progression by mean temperature`,
            nodeGuideRange: 'Valid temperature range',
            nodeGuideTemp: 'Mean temp (°C)',
            nodeGuideNode: `Expected ${usesTrussProgress ? 'truss' : 'node'} progression (${developmentUnit})`,
            nodeGuideWaiting: 'Temperature guide is unavailable.',
            gainLoss: 'Gain/loss trade-off',
            cropInsight: 'Crop-specific insight',
            setpoints: 'Control result',
            scenarios: 'Scenario review',
            customScenarioTitle: 'Custom review row',
            customScenarioBody: 'Add your own heating, cooling, vent, screen, fan, and CO2 row to compare it against the baseline and recommended control.',
            customLabel: 'Scenario label',
            customApply: 'Apply review row',
            customReset: 'Reset',
            baselineCard: 'Baseline review card',
            refresh: 'Refresh',
            includeEnergy: 'Include energy cost',
            includeCooling: 'Include cooling cost',
            includeLabor: 'Include labor load',
            dayMin: 'Minimum mean temp',
            nightMin: 'Night mean temp',
            dayHeating: 'Day heating minimum',
            nightHeating: 'Night heating minimum',
            dayCooling: 'Day cooling target',
            nightCooling: 'Night cooling target',
            ventBias: 'Vent bias',
            screenBias: 'Screen bias',
            circulationFan: 'Circulation fan',
            co2Target: 'CO2 target',
            holdTime: 'Hold time',
            changeLimit: 'Change limit',
            carbonMargin: 'Carbon margin',
            assimilationGain: 'Assimilation gain',
            respirationCost: 'Respiration burden',
            sinkOverload: 'Sink overload risk',
            energyCost: 'Total energy cost',
            heatingEnergy: 'Heating energy',
            coolingEnergy: 'Cooling energy',
            laborCost: 'Labor load',
            yieldChange: 'Yield change',
            humidityRisk: 'Humidity risk',
            diseaseRisk: 'Disease/condensation risk',
            stressPenalty: 'Stress penalty',
            controlEffects: 'Post-control microclimate',
            targetHit: 'Target hit',
            yes: 'Hit',
            no: 'Guarded',
            sensitivity: 'Control sensitivity',
            noScenario: 'Scenario results are not available yet.',
            computing: 'Computing light-linked temperature...',
            modeHeader: 'Scenario',
            meanHeader: 'Tmean',
            nodeHeader: usesTrussProgress ? 'Truss/day' : 'Node/day',
            carbonHeader: 'Carbon/assim',
            riskHeader: 'Humidity/risk',
            energyHeader: 'HVAC cost',
            yieldHeader: 'Yield trend',
            laborHeader: 'Labor',
            telemetryBlockedTitle: 'Fresh calculation is temporarily gated by stale telemetry.',
            telemetryBlockedBody: 'When sensors are stale or offline, the panel keeps the baseline comparison card visible instead of pushing a fresh calculation.',
            disabledTitle: 'Baseline temperature compare',
            disabledBody: 'This profile keeps the automatic control calculation disabled, so only the baseline comparison is shown.',
            profileLoadingTitle: 'Light-linked profile loading',
            profileLoadingBody: 'The control panel will open after the profile contract is confirmed.',
            profileFallbackBody: 'Profile data is unavailable, so the panel is staying on the baseline comparison card.',
            energyUnit: 'kWh/m²/day',
            waitingTarget: `Predicted ${developmentLabelEn} is not available yet. Enter the target value manually to run the control comparison.`,
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
        const targetDisplayRate = toDisplayDevelopmentRate(payload.target_node_development_per_day);
        let cropSummary = payload.crop_summary;

        if (insight?.crop === 'cucumber') {
            const bottleneck = insight.bottleneck_layer ?? 'bottom';
            cropSummary = `The ${bottleneck} canopy layer is the main bottleneck, and ${formatNumber(insight.remaining_leaves ?? null, 0, locale)} remaining leaves are carrying current source capacity.`;
        } else if (insight?.crop === 'tomato') {
            cropSummary = `Active truss load and dominant sink cohort ${insight?.dominant_cohort_id ?? '-'} are driving the current tomato pressure.`;
        }

        return {
            ...payload,
            summary: `The recommended control ${direction} mean temperature by ${roundedDelta}°C to protect the target near ${formatNumber(targetDisplayRate, 2, locale)} ${developmentUnit}.`,
            crop_summary: cropSummary,
            missing_work_event_warning: payload.missing_work_event_warning
                ? insight?.crop === 'cucumber'
                    ? 'Recent leaf-removal history is missing, so source-loss interpretation is less certain.'
                    : 'Recent fruit-thinning history is missing, so sink-load interpretation is less certain.'
                : null,
        };
    }, [locale, optimizeResponse, toDisplayDevelopmentRate, developmentUnit]);

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

    const warningBadges = useMemo(
        () => (optimizeResponse?.warning_badges ?? []).filter((badge) => !shouldHideRiskFlagCode(String(badge))),
        [optimizeResponse],
    );
    const scenarioRows = useMemo(() => scenarioResponse?.scenarios ?? [], [scenarioResponse]);
    const actuatorAvailability =
        optimizeResponse?.actuator_availability
        ?? sensitivityResponse?.actuator_availability
        ?? stateResponse?.actuator_availability
        ?? null;
    const groupedScenarioRows = useMemo(() => {
        const groupOrder = ['baseline', 'hvac', 'vent-screen', 'optimizer'] as const;
        return groupOrder
            .map((group) => ({
                group,
                rows: scenarioRows.filter((row) => (row.group ?? 'optimizer') === group),
            }))
            .filter((entry) => entry.rows.length > 0);
    }, [scenarioRows]);
    const riskFlags = useMemo(
        () => (optimizeResponse?.feasibility.risk_flags ?? []).filter((riskFlag) => !shouldHideRiskFlag(riskFlag)),
        [optimizeResponse],
    );
    const hasOptimizerSurface = optimizeResponse !== null || scenarioResponse !== null || sensitivityResponse !== null;
    const targetHit = optimizeResponse?.feasibility.target_node_hit ?? false;
    const confidence = optimizeResponse?.feasibility.confidence ?? null;
    const readiness = getReadinessDescriptor(confidence, locale);
    const energySummary = optimizeResponse?.energy_summary ?? null;
    const laborSummary = optimizeResponse?.labor_summary ?? null;
    const yieldSummary = optimizeResponse?.yield_summary ?? null;
    const postControlEnv = optimizeResponse?.control_effect_trace?.env ?? null;
    const waitingForTarget = !loadingState && targetNodeDevelopmentPerDay === null;
    const telemetryWarning = getTelemetryWarningCopy(telemetryStatus, locale);
    const lowConfidence = confidence !== null && confidence < 0.75;
    const compactPending = !optimizeResponse && (loadingOptimize || loadingState);
    const controlGuidance = useMemo(() => {
        if (optimizeResponse?.control_guidance) {
            return optimizeResponse.control_guidance;
        }
        if (!profile?.optimizer) {
            return null;
        }
        return {
            target_horizon: 'today' as const,
            day_hold_hours: 14,
            night_hold_hours: 10,
            change_limit_C_per_step: profile.optimizer.temp_slew_rate_C_per_step,
            max_delta_temp_C: profile.optimizer.max_delta_temp_C,
            max_rtr_ratio_delta: profile.optimizer.max_rtr_ratio_delta,
        };
    }, [optimizeResponse, profile]);

    const nodeGuideRows = useMemo(() => {
        const backendRows = explanationCopy?.temperature_development_rows;
        if (Array.isArray(backendRows) && backendRows.length > 0) {
            return backendRows
                .filter((row) => Number.isFinite(row?.mean_temp_C) && Number.isFinite(row?.development_rate_day))
                .map((row) => ({
                    meanTempC: Number(Number(row.mean_temp_C).toFixed(1)),
                    nodeRate: Math.max(0, Number(Number(row.development_rate_day).toFixed(3))),
                }));
        }
        return [] as Array<{ meanTempC: number; nodeRate: number }>;
    }, [explanationCopy]);

    const nodeGuideRangeLabel = useMemo(() => {
        const maxTemp = nodeGuideRows[nodeGuideRows.length - 1]?.meanTempC;
        if (!Number.isFinite(maxTemp)) {
            return null;
        }
        return `15.0 ~ ${Number(maxTemp).toFixed(1)}°C`;
    }, [nodeGuideRows]);

    const hasCustomScenarioDraft =
        customScenarioDraft.dayHeatingMinTempC.trim().length > 0
        || customScenarioDraft.nightHeatingMinTempC.trim().length > 0
        || customScenarioDraft.dayCoolingTargetC.trim().length > 0
        || customScenarioDraft.nightCoolingTargetC.trim().length > 0
        || customScenarioDraft.ventBiasC.trim().length > 0
        || customScenarioDraft.screenBiasPct.trim().length > 0
        || customScenarioDraft.circulationFanPct.trim().length > 0
        || customScenarioDraft.co2TargetPpm.trim().length > 0;

    const compactCopy = locale === 'ko'
        ? {
            title: '추천 제어안',
            subtitle: '오늘 바로 적용할 온도 전략만 짧게 봅니다.',
            summaryLabel: '오늘 전략',
            summaryLoading: '추천 제어안을 계산하는 중입니다.',
            summaryFallback: '값이 준비되면 추천 제어안을 보여드립니다.',
            comparisonTitle: '평소 설정 대비',
            reasonTitle: '판단 근거',
            metricHeader: '항목',
            baselineHeader: '평소 설정',
            recommendedHeader: '추천',
            areaLabel: '면적 기준',
            strategyMode: '계산 기준',
            dayHeating: '난방 시작(주간)',
            nightHeating: '난방 시작(야간)',
            dayCooling: '냉방 시작(주간)',
            nightCooling: '냉방 시작(야간)',
            ventBias: '환기 기준',
            screenBias: '스크린',
            circulationFan: '순환팬',
            co2Target: '이산화탄소 목표',
            meanTemp: '평균 온도',
            nodeRate: developmentHeaderKo,
            energyCost: '에너지 비용',
            laborCost: '작업량',
        }
        : {
            title: 'Recommended control',
            subtitle: 'Keep only the compact temperature strategy summary.',
            summaryLabel: 'Today',
            summaryLoading: 'Calculating the recommended control now.',
            summaryFallback: 'The recommended control will appear when fresh values arrive.',
            comparisonTitle: 'Baseline vs recommended',
            reasonTitle: 'Why this plan',
            metricHeader: 'Metric',
            baselineHeader: 'Baseline',
            recommendedHeader: 'Recommended',
            areaLabel: 'Area basis',
            strategyMode: 'Mode',
            dayHeating: 'Day heating',
            nightHeating: 'Night heating',
            dayCooling: 'Day cooling',
            nightCooling: 'Night cooling',
            ventBias: 'Vent bias',
            screenBias: 'Screen',
            circulationFan: 'Circulation fan',
            co2Target: 'CO2 target',
            meanTemp: 'Mean temp',
            nodeRate: 'Node rate',
            energyCost: 'Energy cost',
            laborCost: 'Labor load',
        };
    const compactPendingValue = locale === 'ko' ? '계산 중' : 'Calculating';
    const formatCompactValue = (
        value: number | null | undefined,
        digits: number,
        suffix = '',
    ): string => {
        if (compactPending) {
            return compactPendingValue;
        }
        const formatted = formatNumber(value, digits, locale);
        return formatted === '-' || suffix.length === 0 ? formatted : `${formatted}${suffix}`;
    };
    const formatCompactCostValue = (value: number | null | undefined, digits = 0): string => {
        if (compactPending) {
            return compactPendingValue;
        }
        return `${formatNumber(value, digits, locale)} ${locale === 'ko' ? '원' : 'KRW'}`;
    };
    const compactSummary = explanationCopy?.summary
        ?? (locale === 'ko'
            ? `평소 설정 대비 ${formatNumber(optimizeResponse?.rtr_equivalent.delta_temp_C, 2, locale)}°C 조정해 ${usesTrussProgress ? '화방 진행' : '마디 전개'} 속도를 맞춥니다.`
            : `Shift mean temperature by ${formatNumber(optimizeResponse?.rtr_equivalent.delta_temp_C, 2, locale)}°C versus baseline.`);
    const compactReasonTags = explanationCopy?.reason_tags ?? [];
    const compactAreaSummary = locale === 'ko'
        ? `m² 기준 ${formatNumber(areaState.canonicalAreaM2, 1, locale)} / 실면적 ${formatNumber(areaState.actualAreaM2, 1, locale)} m² (${formatNumber(areaState.actualAreaPyeong, 0, locale)}평)`
        : `Base ${formatNumber(areaState.canonicalAreaM2, 1, locale)} m² / actual ${formatNumber(areaState.actualAreaM2, 1, locale)} m² (${formatNumber(areaState.actualAreaPyeong, 0, locale)} pyeong)`;
    const compactTargetTiles = [
        {
            label: compactCopy.dayHeating,
            value: formatCompactValue(
                optimizeResponse?.optimal_targets.day_heating_min_temp_C ?? optimizeResponse?.optimal_targets.day_min_temp_C,
                1,
                '°C',
            ),
        },
        {
            label: compactCopy.nightHeating,
            value: formatCompactValue(
                optimizeResponse?.optimal_targets.night_heating_min_temp_C ?? optimizeResponse?.optimal_targets.night_min_temp_C,
                1,
                '°C',
            ),
        },
        {
            label: compactCopy.dayCooling,
            value: formatCompactValue(optimizeResponse?.optimal_targets.day_cooling_target_C, 1, '°C'),
        },
        {
            label: compactCopy.nightCooling,
            value: formatCompactValue(optimizeResponse?.optimal_targets.night_cooling_target_C, 1, '°C'),
        },
        {
            label: compactCopy.ventBias,
            value: formatCompactValue(optimizeResponse?.optimal_targets.vent_bias_C, 2, '°C'),
        },
        {
            label: compactCopy.screenBias,
            value: formatCompactValue(optimizeResponse?.optimal_targets.screen_bias_pct, 1, '%'),
        },
        {
            label: compactCopy.circulationFan,
            value: formatCompactValue(optimizeResponse?.optimal_targets.circulation_fan_pct, 0, '%'),
        },
        {
            label: compactCopy.co2Target,
            value: formatCompactValue(optimizeResponse?.optimal_targets.co2_target_ppm, 0, ' ppm'),
        },
    ];
    const predictedDevelopmentRate = toDisplayDevelopmentRate(stateResponse?.canonical_state.growth.predicted_node_rate_day);
    const targetDevelopmentRate = toDisplayDevelopmentRate(targetNodeDevelopmentPerDay);
    const compactComparisonRows = [
        {
            label: compactCopy.meanTemp,
            baseline: formatCompactValue(optimizeResponse?.baseline.targets.mean_temp_C, 1, '°C'),
            recommended: formatCompactValue(optimizeResponse?.optimal_targets.mean_temp_C, 1, '°C'),
        },
        {
            label: compactCopy.nodeRate,
            baseline: compactPending
                ? compactPendingValue
                : formatNumber(predictedDevelopmentRate, 3, locale),
            recommended: compactPending
                ? compactPendingValue
                : formatNumber(targetDevelopmentRate, 3, locale),
        },
        {
            label: compactCopy.energyCost,
            baseline: formatCompactCostValue(optimizeResponse?.baseline.objective_breakdown.energy_cost_krw),
            recommended: formatCompactCostValue(
                energySummary?.total_energy_cost_krw_m2_day ?? optimizeResponse?.objective_breakdown.energy_cost_krw,
            ),
        },
        {
            label: compactCopy.laborCost,
            baseline: compactPending
                ? compactPendingValue
                : formatNumber(optimizeResponse?.baseline.objective_breakdown.labor_index, 3, locale),
            recommended: compactPending
                ? compactPendingValue
                : formatNumber(laborSummary?.labor_index ?? optimizeResponse?.objective_breakdown.labor_index, 3, locale),
        },
    ];

    if (isProfilePending) {
        return (
                        <div className={`flex h-full flex-col rounded-[24px] bg-white/82 ${compact ? 'p-3' : 'p-5'}`} style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div className="rounded-[20px] bg-[color:var(--sg-surface-muted)] px-3 py-3 text-sm leading-6 text-[color:var(--sg-text)]">
                    <p className="font-semibold text-[color:var(--sg-text-strong)]">{copy.profileLoadingTitle}</p>
                    <p className="mt-1">{copy.profileLoadingBody}</p>
                </div>
            </div>
        );
    }

    if (isProfileUnavailable || !optimizerEnabled) {
        return (
                        <div className={`flex h-full flex-col rounded-[24px] bg-white/82 ${compact ? 'p-3' : 'p-5'}`} style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                {profileErrorCopy ? (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                        {profileErrorCopy}
                    </div>
                ) : null}
                                <div className="mb-4 rounded-[20px] bg-[color:var(--sg-surface-muted)] px-3 py-3 text-sm leading-6 text-[color:var(--sg-text)]">
                    <p className="font-semibold text-[color:var(--sg-text-strong)]">{copy.disabledTitle}</p>
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
                    profileError={profileErrorCopy}
                    compact={compact}
                />
            </div>
        );
    }

    if (telemetryStatus === 'offline' || (telemetryStatus === 'stale' && !hasOptimizerSurface)) {
        return (
                        <div className={`flex h-full flex-col rounded-[24px] bg-white/82 ${compact ? 'p-3' : 'p-5'}`} style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div className="mb-4 rounded-[20px] bg-[color:var(--sg-surface-muted)] px-3 py-3 text-sm leading-6 text-[color:var(--sg-text)]">
                    <p className="font-semibold text-[color:var(--sg-text-strong)]">{copy.telemetryBlockedTitle}</p>
                    <p className="mt-1">{copy.telemetryBlockedBody}</p>
                    {telemetryWarning ? (
                        <p className="mt-2 text-xs text-[color:var(--sg-text)]">{telemetryWarning}</p>
                    ) : null}
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
                    profileError={profileErrorCopy}
                    compact={compact}
                />
            </div>
        );
    }

    if (compact) {
        return (
            <div className="flex h-full flex-col rounded-[24px] bg-white/82 p-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 text-[color:var(--sg-text-strong)]">
                            <CircleGauge className="h-5 w-5 text-[color:var(--sg-accent-violet)]" />
                            <h3 className="text-sm font-semibold">{compactCopy.title}</h3>
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--sg-text-muted)]">{compactCopy.subtitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void refreshOptimization()}
                        disabled={loadingState || loadingOptimize || optimizerLoading || waitingForTarget || telemetryOptimizationBlocked}
                        className="rounded-full border border-[color:var(--sg-outline-soft)] bg-white/84 px-3 py-2 text-xs font-medium text-[color:var(--sg-text)] transition hover:border-[color:var(--sg-accent-rose)] hover:text-[color:var(--sg-accent-rose)] focus:outline-none focus:ring-2 focus:ring-[color:var(--sg-accent-violet-soft)]"
                    >
                        {copy.refresh}
                    </button>
                </div>
                <div className="space-y-4">
                    {optimizerErrorCopy ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                            {optimizerErrorCopy}
                        </div>
                    ) : null}
                    {waitingForTarget ? (
                        <div className="rounded-[18px] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text)]">
                            {copy.waitingTarget}
                        </div>
                    ) : null}
                    {telemetryWarning ? (
                        <div className="rounded-[18px] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text)]">
                            {telemetryWarning}
                        </div>
                    ) : null}
                    {lowConfidence ? (
                        <div className="rounded-[18px] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text)]">
                            {locale === 'ko'
                                ? '추천값 신뢰도가 낮아 현재 센서와 최근 작업 기록을 함께 확인하는 편이 안전합니다.'
                                : 'Confidence is low, so review recent telemetry and work events before applying aggressive changes.'}
                        </div>
                    ) : null}
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
                    {riskFlags.length > 0 ? (
                        <section className={sectionPanelClass}>
                            <div className="mb-3 flex items-center gap-2">
                                <BadgeAlert className="h-4 w-4 text-amber-600" />
                                <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                    {locale === 'ko' ? '주의와 제한' : 'Warnings and limits'}
                                </h4>
                            </div>
                            <div className="space-y-2">
                                {riskFlags.map((riskFlag, index) => {
                                    const code = String(riskFlag.code ?? `risk-${index}`);
                                    const severity = String(riskFlag.severity ?? 'info');
                                    return (
                                        <div
                                            key={`${code}-${index}`}
                                            className={`rounded-lg border px-3 py-2 text-xs leading-5 ${getRiskSeverityClass(severity)}`}
                                        >
                                            <p className="font-semibold">{getRiskFlagTitle(code, locale)}</p>
                                            <p className="mt-1">{getRiskFlagMessage(riskFlag, locale)}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
                        <section className="sg-warm-panel border border-[color:var(--sg-outline-soft)] p-4">
                            <div className="sg-eyebrow text-[color:var(--sg-accent-violet)]">{compactCopy.summaryLabel}</div>
                            <p className="mt-2 text-xl font-semibold leading-8 text-[color:var(--sg-text-strong)]">
                                {optimizeResponse
                                    ? compactSummary
                                    : compactPending
                                        ? compactCopy.summaryLoading
                                        : compactCopy.summaryFallback}
                            </p>
                            <label className="mt-4 block text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.targetNode}</span>
                                <input
                                    aria-label={copy.targetNode}
                                    inputMode="decimal"
                                    disabled={telemetryOptimizationBlocked}
                                    className="sg-field-input mt-2"
                                    value={targetNodeInputDisplayValue}
                                    onFocus={handleTargetNodeInputFocus}
                                    onBlur={handleTargetNodeInputBlur}
                                    onChange={(event) => {
                                        handleTargetNodeInputChange(event.target.value);
                                    }}
                                />
                                <span className={metricMetaClass}>{copy.targetNodeHint}</span>
                            </label>
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className={metricTileClass}>
                                    <div className={metricLabelClass}>{copy.predictedNode}</div>
                                    <div className={metricValueClass}>{formatNumber(predictedDevelopmentRate, 3, locale)}</div>
                                </div>
                                <div className={metricTileClass}>
                                    <div className={metricLabelClass}>{copy.targetNode}</div>
                                    <div className={metricValueClass}>
                                        {formatNumber(targetDevelopmentRate, 3, locale)}
                                    </div>
                                </div>
                                <div className={metricTileClass}>
                                    <div className={metricLabelClass}>{copy.confidence}</div>
                                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-[color:var(--sg-text-strong)]">
                                        {targetHit ? <CheckCircle2 className="h-4 w-4 text-[color:var(--sg-accent-violet)]" /> : <BadgeAlert className="h-4 w-4 text-amber-600" />}
                                        {readiness.label}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="sg-warm-panel border border-[color:var(--sg-outline-soft)] p-4">
                            <div className={metricLabelClass}>{compactCopy.areaLabel}</div>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text)]">{compactAreaSummary}</p>
                            <div className="mt-4 grid gap-3">
                                <div className={metricTileClass}>
                                    <div className={metricLabelClass}>{compactCopy.strategyMode}</div>
                                    <div className={metricValueClass}>{getModeLabel(optimizationMode, locale)}</div>
                                </div>
                                <div className={metricTileClass}>
                                    <div className={metricLabelClass}>{copy.changeLimit}</div>
                                    <div className={metricValueClass}>
                                        {controlGuidance ? `${formatNumber(controlGuidance.change_limit_C_per_step, 2, locale)}°C` : '-'}
                                    </div>
                                </div>
                                <div className={metricTileClass}>
                                    <div className={metricLabelClass}>{copy.holdTime}</div>
                                    <div className={metricValueClass}>
                                        {controlGuidance
                                            ? locale === 'ko'
                                                ? `주간 ${formatNumber(controlGuidance.day_hold_hours, 0, locale)}h / 야간 ${formatNumber(controlGuidance.night_hold_hours, 0, locale)}h`
                                                : `Day ${formatNumber(controlGuidance.day_hold_hours, 0, locale)}h / Night ${formatNumber(controlGuidance.night_hold_hours, 0, locale)}h`
                                            : '-'}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className={sectionPanelClass}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Thermometer className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                                <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.nodeGuideTitle}</h4>
                            </div>
                            {nodeGuideRangeLabel ? (
                                <span className="rounded-full bg-[color:var(--sg-surface-muted)] px-3 py-1 text-[11px] font-medium text-[color:var(--sg-text)]">
                                    {copy.nodeGuideRange}: {nodeGuideRangeLabel}
                                </span>
                            ) : null}
                        </div>
                        {nodeGuideRows.length > 0 ? (
                            <div className="max-h-[200px] overflow-y-auto rounded-[14px] border border-[color:var(--sg-outline-soft)] bg-white/72">
                                <table className="min-w-full text-left text-xs text-[color:var(--sg-text)]">
                                    <thead className="sticky top-0 bg-white/95 text-[11px] uppercase tracking-wide text-[color:var(--sg-text-faint)]">
                                        <tr>
                                            <th className="px-3 py-2">{copy.nodeGuideTemp}</th>
                                            <th className="px-3 py-2">{copy.nodeGuideNode}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {nodeGuideRows.map((row) => (
                                            <tr key={`compact-${row.meanTempC}`} className="border-t border-[color:var(--sg-outline-soft)]">
                                                <td className="px-3 py-2">{formatNumber(row.meanTempC, 1, locale)}°C</td>
                                                <td className="px-3 py-2">{formatNumber(row.nodeRate, 3, locale)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="rounded-[14px] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text)]">
                                {copy.nodeGuideWaiting}
                            </div>
                        )}
                    </section>

                    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {compactTargetTiles.map((tile) => (
                            <div key={tile.label} className={metricTileClass}>
                                <div className={metricLabelClass}>{tile.label}</div>
                                <div className={metricValueClass}>{tile.value}</div>
                            </div>
                        ))}
                    </section>

                    <section className={sectionPanelClass}>
                        <div className="mb-3 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                            <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{compactCopy.comparisonTitle}</h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs text-[color:var(--sg-text)]">
                                <thead className="text-[11px] uppercase tracking-wide text-[color:var(--sg-text-faint)]">
                                    <tr>
                                        <th className="px-2 py-2">{compactCopy.metricHeader}</th>
                                        <th className="px-2 py-2">{compactCopy.baselineHeader}</th>
                                        <th className="px-2 py-2">{compactCopy.recommendedHeader}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {compactComparisonRows.map((row) => (
                                        <tr key={row.label} className="border-t border-[color:var(--sg-outline-soft)]">
                                            <td className="px-2 py-2 font-medium text-[color:var(--sg-text-strong)]">{row.label}</td>
                                            <td className="px-2 py-2">{row.baseline}</td>
                                            <td className="px-2 py-2">{row.recommended}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {compactReasonTags.length > 0 ? (
                        <section className={sectionPanelClass}>
                            <div className="mb-3 flex items-center gap-2">
                                <Leaf className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                                <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{compactCopy.reasonTitle}</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {compactReasonTags.map((tag) => (
                                    <span key={tag} className="rounded-full bg-[color:var(--sg-surface-muted)] px-3 py-1 text-[11px] font-medium text-[color:var(--sg-text)]">
                                        {getReasonTagLabel(tag, locale)}
                                    </span>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
                        <div className={`flex h-full flex-col rounded-[24px] bg-white/82 ${compact ? 'p-3' : 'p-5'}`} style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-[color:var(--sg-text-strong)]">
                        <CircleGauge className="h-5 w-5 text-[color:var(--sg-accent-violet)]" />
                        <h3 className={compact ? 'text-sm font-semibold' : 'font-semibold'}>{copy.title}</h3>
                    </div>
                    {!compact ? (
                        <p className="mt-1 text-xs text-[color:var(--sg-text-muted)]">{copy.subtitle}</p>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={() => void refreshOptimization()}
                    disabled={loadingState || loadingOptimize || optimizerLoading || waitingForTarget || telemetryOptimizationBlocked}
                    className="rounded-full border border-[color:var(--sg-outline-soft)] bg-white/84 px-3 py-2 text-xs font-medium text-[color:var(--sg-text)] transition hover:border-[color:var(--sg-accent-rose)] hover:text-[color:var(--sg-accent-rose)] focus:outline-none focus:ring-2 focus:ring-[color:var(--sg-accent-violet-soft)]"
                >
                    {copy.refresh}
                </button>
            </div>
            <div className="space-y-4">
                {optimizerErrorCopy ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                        {optimizerErrorCopy}
                    </div>
                ) : null}
                {waitingForTarget ? (
                                    <div className="rounded-[18px] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text)]">
                        {copy.waitingTarget}
                    </div>
                ) : null}
                {telemetryWarning ? (
                                    <div className="rounded-[18px] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text)]">
                        {telemetryWarning}
                    </div>
                ) : null}
                {lowConfidence ? (
                                    <div className="rounded-[18px] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text)]">
                        {locale === 'ko'
                            ? `현재 추천안은 추가 확인이 필요합니다. 작업 이벤트와 최신 센서를 다시 확인한 뒤 적용하는 것이 좋습니다.`
                            : `This recommendation needs extra review, so refresh work events and telemetry before applying aggressive changes.`}
                    </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                    <label className="rounded-[18px] bg-[color:var(--sg-surface-muted)] p-3 text-xs font-medium text-[color:var(--sg-text)]">
                        <span>{copy.targetNode}</span>
                        <input
                            aria-label={copy.targetNode}
                            inputMode="decimal"
                            disabled={telemetryOptimizationBlocked}
                            className="sg-field-input mt-2"
                            value={targetNodeInputDisplayValue}
                            onFocus={handleTargetNodeInputFocus}
                            onBlur={handleTargetNodeInputBlur}
                            onChange={(event) => {
                                handleTargetNodeInputChange(event.target.value);
                            }}
                        />
                        <span className={metricMetaClass}>{copy.targetNodeHint}</span>
                    </label>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.predictedNode}</div>
                        <div className={metricValueLargeClass}>
                            {formatNumber(predictedDevelopmentRate, 3, locale)}
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.recommendedMeanTemp}</div>
                        <div className={metricValueLargeClass}>
                            {formatNumber(optimizeResponse?.optimal_targets.mean_temp_C, 1, locale)}°C
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.deltaTemp}</div>
                        <div className="mt-1 flex items-center gap-2 text-xl font-semibold text-[color:var(--sg-text-strong)]">
                            {(optimizeResponse?.rtr_equivalent.delta_temp_C ?? 0) >= 0 ? (
                                <ArrowUpRight className="h-4 w-4 text-rose-600" />
                            ) : (
                                <ArrowDownRight className="h-4 w-4 text-[color:var(--sg-accent-earth)]" />
                            )}
                            {formatNumber(optimizeResponse?.rtr_equivalent.delta_temp_C, 2, locale)}°C
                        </div>
                        <div className={metricMetaClass}>
                            {locale === 'ko' ? '평소 설정 기준' : 'Against baseline setting'}
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.rtrEquivalent}</div>
                        <div className={metricValueLargeClass}>
                            {formatNumber(optimizeResponse?.rtr_equivalent.optimized_ratio, 3, locale)}
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.confidence}</div>
                        <div className="mt-1 flex items-center gap-2 text-xl font-semibold text-[color:var(--sg-text-strong)]">
                            {targetHit ? <CheckCircle2 className="h-4 w-4 text-[color:var(--sg-accent-violet)]" /> : <BadgeAlert className="h-4 w-4 text-amber-600" />}
                            {readiness.label}
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.carbonMargin}</div>
                        <div className={metricValueLargeClass}>
                            {formatNumber(optimizeResponse?.flux_projection.carbon_margin, 3, locale)}
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.heatingEnergy}</div>
                        <div className={metricValueLargeClass}>
                            {formatNumber(energySummary?.heating_cost_krw_m2_day, 0, locale)} {locale === 'ko' ? '원' : 'KRW'}
                        </div>
                        <div className={metricMetaClass}>
                            {formatNumber(energySummary?.heating_energy_kWh_m2_day, 3, locale)} kWh/m²/day
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.coolingEnergy}</div>
                        <div className={metricValueLargeClass}>
                            {formatNumber(energySummary?.cooling_cost_krw_m2_day, 0, locale)} {locale === 'ko' ? '원' : 'KRW'}
                        </div>
                        <div className={metricMetaClass}>
                            {formatNumber(energySummary?.cooling_energy_kWh_m2_day, 3, locale)} kWh/m²/day
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.energyCost}</div>
                        <div className={metricValueLargeClass}>
                            {formatNumber(energySummary?.total_energy_cost_krw_m2_day, 0, locale)} {locale === 'ko' ? '원' : 'KRW'}
                        </div>
                        <div className={metricMetaClass}>
                            {locale === 'ko'
                                ? `실면적 ${formatNumber(optimizeResponse?.actual_area_projection.energy_kwh_day, 1, locale)} kWh/일`
                                : `${formatNumber(optimizeResponse?.actual_area_projection.energy_kwh_day, 1, locale)} kWh/day @ actual area`}
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.laborCost}</div>
                        <div className={metricValueLargeClass}>
                            {formatNumber(laborSummary?.labor_index, 3, locale)}
                        </div>
                        <div className={metricMetaClass}>
                            {locale === 'ko'
                                ? `실면적 ${formatNumber(optimizeResponse?.actual_area_projection.labor_cost_krw_day, 0, locale)} 원/일`
                                : `${formatNumber(optimizeResponse?.actual_area_projection.labor_cost_krw_day, 0, locale)} KRW/day @ actual area`}
                        </div>
                    </div>
                    <div className={metricTileClass}>
                        <div className={metricLabelClass}>{copy.yieldChange}</div>
                        <div className={metricValueLargeClass}>
                            {formatNumber(yieldSummary?.harvest_trend_delta_pct, 1, locale)}%
                        </div>
                        <div className={metricMetaClass}>
                            {locale === 'ko'
                                ? `실면적 ${formatNumber(optimizeResponse?.actual_area_projection.yield_kg_day, 1, locale)} kg/일`
                            : `${formatNumber(optimizeResponse?.actual_area_projection.yield_kg_day, 1, locale)} kg/day @ actual area`}
                        </div>
                    </div>
                </div>

                <section className={sectionPanelClass}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Thermometer className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                            <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.nodeGuideTitle}</h4>
                        </div>
                        {nodeGuideRangeLabel ? (
                            <span className="rounded-full bg-[color:var(--sg-surface-muted)] px-3 py-1 text-[11px] font-medium text-[color:var(--sg-text)]">
                                {copy.nodeGuideRange}: {nodeGuideRangeLabel}
                            </span>
                        ) : null}
                    </div>
                    {nodeGuideRows.length > 0 ? (
                        <div className="max-h-[220px] overflow-y-auto rounded-[14px] border border-[color:var(--sg-outline-soft)] bg-white/72">
                            <table className="min-w-full text-left text-xs text-[color:var(--sg-text)]">
                                <thead className="sticky top-0 bg-white/95 text-[11px] uppercase tracking-wide text-[color:var(--sg-text-faint)]">
                                    <tr>
                                        <th className="px-3 py-2">{copy.nodeGuideTemp}</th>
                                        <th className="px-3 py-2">{copy.nodeGuideNode}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nodeGuideRows.map((row) => (
                                        <tr key={row.meanTempC} className="border-t border-[color:var(--sg-outline-soft)]">
                                            <td className="px-3 py-2">{formatNumber(row.meanTempC, 1, locale)}°C</td>
                                            <td className="px-3 py-2">{formatNumber(row.nodeRate, 3, locale)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-[14px] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text)]">
                            {copy.nodeGuideWaiting}
                        </div>
                    )}
                </section>

                <div className="flex flex-wrap gap-2">
                    {MODE_ORDER.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setOptimizationMode(mode)}
                            disabled={telemetryOptimizationBlocked}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                optimizationMode === mode
                                    ? 'bg-[color:var(--sg-accent-violet)] text-white'
                                    : 'bg-[color:var(--sg-surface-muted)] text-[color:var(--sg-text)] hover:bg-[color:var(--sg-accent-earth-soft)]'
                            }`}
                        >
                            {getModeLabel(mode, locale)}
                        </button>
                    ))}
                    <label className="ml-auto flex items-center gap-2 text-xs text-[color:var(--sg-text)]">
                        <input
                            type="checkbox"
                            checked={includeEnergyCost}
                            disabled={telemetryOptimizationBlocked}
                            onChange={(event) => setIncludeEnergyCost(event.target.checked)}
                        />
                        {copy.includeEnergy}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[color:var(--sg-text)]">
                        <input
                            type="checkbox"
                            checked={includeCoolingCost}
                            disabled={telemetryOptimizationBlocked}
                            onChange={(event) => setIncludeCoolingCost(event.target.checked)}
                        />
                        {copy.includeCooling}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[color:var(--sg-text)]">
                        <input
                            type="checkbox"
                            checked={includeLaborCost}
                            disabled={telemetryOptimizationBlocked}
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
                {riskFlags.length > 0 ? (
                    <section className={sectionPanelClass}>
                        <div className="mb-3 flex items-center gap-2">
                            <BadgeAlert className="h-4 w-4 text-amber-600" />
                            <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                {locale === 'ko' ? '제약 및 위험 경고' : 'Constraint and risk warnings'}
                            </h4>
                        </div>
                        <div className="space-y-2">
                            {riskFlags.map((riskFlag, index) => {
                                const code = String(riskFlag.code ?? `risk-${index}`);
                                const severity = String(riskFlag.severity ?? 'info');
                                return (
                                    <div
                                        key={`${code}-${index}`}
                                        className={`rounded-lg border px-3 py-2 text-xs leading-5 ${getRiskSeverityClass(severity)}`}
                                    >
                                        <p className="font-semibold">
                                            {getRiskFlagTitle(code, locale)}
                                        </p>
                                        <p className="mt-1">
                                            {getRiskFlagMessage(riskFlag, locale)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                <AreaUnitPanel
                    crop={crop}
                    canonicalAreaM2={areaState.canonicalAreaM2}
                    actualAreaM2={areaState.actualAreaM2}
                    actualAreaPyeong={areaState.actualAreaPyeong}
                    source={areaState.source}
                    unitsM2={optimizeResponse?.units_m2 ?? null}
                    projection={optimizeResponse?.actual_area_projection ?? null}
                    onActualAreaM2Change={(value) => setActualAreaM2(crop, value)}
                    onActualAreaPyeongChange={(value) => setActualAreaPyeong(crop, value)}
                />

                <section className={sectionPanelClass}>
                    <div className="mb-3 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                        <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.gainLoss}</h4>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.assimilationGain}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.objective_breakdown.assimilation_gain, 3, locale)}</div>
                            <div className={metricMetaClass}>
                                {formatNumber(optimizeResponse?.flux_projection.net_assim_umol_m2_s, 2, locale)} μmol/m²/s
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.respirationCost}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.objective_breakdown.respiration_cost, 3, locale)}</div>
                            <div className={metricMetaClass}>
                                {formatNumber(optimizeResponse?.flux_projection.respiration_umol_m2_s, 2, locale)} μmol/m²/s
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.carbonMargin}</div>
                            <div className={metricValueClass}>
                                {formatNumber(optimizeResponse?.flux_projection.carbon_margin, 3, locale)}
                            </div>
                            <div className={metricMetaClass}>
                                {optimizeResponse?.feasibility.carbon_margin_positive ? copy.yes : copy.no}
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.sinkOverload}</div>
                            <div className={metricValueClass}>
                                {formatNumber(optimizeResponse?.objective_breakdown.sink_overload_penalty, 3, locale)}
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.heatingEnergy}</div>
                            <div className={metricValueClass}>
                                {formatNumber(energySummary?.heating_cost_krw_m2_day, 0, locale)} {locale === 'ko' ? '원' : 'KRW'}
                            </div>
                            <div className={metricMetaClass}>
                                {formatNumber(energySummary?.heating_energy_kWh_m2_day, 3, locale)} kWh/m²/day
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.coolingEnergy}</div>
                            <div className={metricValueClass}>
                                {formatNumber(energySummary?.cooling_cost_krw_m2_day, 0, locale)} {locale === 'ko' ? '원' : 'KRW'}
                            </div>
                            <div className={metricMetaClass}>
                                {formatNumber(energySummary?.cooling_energy_kWh_m2_day, 3, locale)} kWh/m²/day
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.energyCost}</div>
                            <div className={metricValueClass}>
                                {formatNumber(energySummary?.total_energy_cost_krw_m2_day, 0, locale)} {locale === 'ko' ? '원' : 'KRW'}
                            </div>
                            <div className={metricMetaClass}>
                                {formatNumber(energySummary?.total_energy_kWh_m2_day, 3, locale)} kWh/m²/day
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.laborCost}</div>
                            <div className={metricValueClass}>
                                {formatNumber(laborSummary?.labor_index, 3, locale)}
                            </div>
                            <div className={metricMetaClass}>
                                {formatNumber(laborSummary?.labor_hours_m2_day, 3, locale)} h/m²/day
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.humidityRisk}</div>
                            <div className={metricValueClass}>
                                {formatNumber(optimizeResponse?.objective_breakdown.humidity_risk_penalty, 3, locale)}
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.diseaseRisk}</div>
                            <div className={metricValueClass}>
                                {formatNumber(optimizeResponse?.objective_breakdown.disease_penalty, 3, locale)}
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.stressPenalty}</div>
                            <div className={metricValueClass}>
                                {formatNumber(optimizeResponse?.objective_breakdown.stress_penalty, 3, locale)}
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.yieldChange}</div>
                            <div className={metricValueClass}>
                                {formatNumber(yieldSummary?.harvest_trend_delta_pct, 1, locale)}%
                            </div>
                            <div className={metricMetaClass}>
                                {formatNumber(yieldSummary?.predicted_yield_kg_m2_day, 3, locale)} kg/m²/day
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.targetHit}</div>
                            <div className={metricValueClass}>{targetHit ? copy.yes : copy.no}</div>
                        </div>
                    </div>
                    {explanationCopy ? (
                        <div className="mt-4 rounded-lg bg-[color:var(--sg-status-live-bg)] px-3 py-3 text-sm leading-6 text-[color:var(--sg-text)]">
                            <p className="font-medium text-[color:var(--sg-text-strong)]">{explanationCopy.summary}</p>
                            <p className="mt-2">{explanationCopy.crop_summary}</p>
                            {explanationCopy.reason_tags.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {explanationCopy.reason_tags.map((tag) => (
                                        <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[color:var(--sg-status-live-text)] ring-1 ring-[color:var(--sg-outline-soft)]">
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

                <section className={sectionPanelClass}>
                    <div className="mb-3 flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                        <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.cropInsight}</h4>
                    </div>
                    {renderCropSpecificInsight(optimizeResponse?.crop_specific_insight ?? null, locale)}
                </section>
                <section className={sectionPanelClass}>
                    <div className="mb-3 flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                        <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.controlEffects}</h4>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{locale === 'ko' ? '제어 후 기온' : 'Post-control air temp'}</div>
                            <div className={metricValueClass}>{formatNumber(postControlEnv?.Tin_post_C, 1, locale)}°C</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{locale === 'ko' ? '제어 후 엽온' : 'Post-control leaf temp'}</div>
                            <div className={metricValueClass}>{formatNumber(postControlEnv?.Tleaf_post_C, 1, locale)}°C</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{locale === 'ko' ? '제어 후 상대습도' : 'Post-control RH'}</div>
                            <div className={metricValueClass}>{formatNumber(postControlEnv?.RH_post_pct, 1, locale)}%</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{locale === 'ko' ? '제어 후 VPD' : 'Post-control VPD'}</div>
                            <div className={metricValueClass}>{formatNumber(postControlEnv?.VPD_post_kPa, 2, locale)} kPa</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{locale === 'ko' ? '제어 후 CO₂' : 'Post-control CO2'}</div>
                            <div className={metricValueClass}>{formatNumber(postControlEnv?.CO2_post_ppm, 0, locale)} ppm</div>
                        </div>
                    </div>
                </section>
                <section className={sectionPanelClass}>
                    <div className="mb-3 flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                        <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.setpoints}</h4>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.dayHeating}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.optimal_targets.day_heating_min_temp_C, 1, locale)}°C</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.nightHeating}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.optimal_targets.night_heating_min_temp_C, 1, locale)}°C</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.dayCooling}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.optimal_targets.day_cooling_target_C, 1, locale)}°C</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.nightCooling}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.optimal_targets.night_cooling_target_C, 1, locale)}°C</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.ventBias}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.optimal_targets.vent_bias_C, 2, locale)}°C</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.screenBias}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.optimal_targets.screen_bias_pct, 1, locale)}%</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.circulationFan}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.optimal_targets.circulation_fan_pct, 0, locale)}%</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.co2Target}</div>
                            <div className={metricValueClass}>{formatNumber(optimizeResponse?.optimal_targets.co2_target_ppm, 0, locale)} ppm</div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.holdTime}</div>
                            <div className={metricValueClass}>
                                {controlGuidance
                                    ? locale === 'ko'
                                        ? `주간 ${formatNumber(controlGuidance.day_hold_hours, 0, locale)}h / 야간 ${formatNumber(controlGuidance.night_hold_hours, 0, locale)}h`
                                        : `Day ${formatNumber(controlGuidance.day_hold_hours, 0, locale)}h / Night ${formatNumber(controlGuidance.night_hold_hours, 0, locale)}h`
                                    : '-'}
                            </div>
                        </div>
                        <div className={metricTileClass}>
                            <div className={metricLabelClass}>{copy.changeLimit}</div>
                            <div className={metricValueClass}>
                                {controlGuidance
                                    ? `${formatNumber(controlGuidance.change_limit_C_per_step, 2, locale)}°C/step`
                                    : '-'}
                            </div>
                            {controlGuidance ? (
                                <div className={metricMetaClass}>
                                    {locale === 'ko'
                                        ? `총 변경 한도 ±${formatNumber(controlGuidance.max_delta_temp_C, 1, locale)}°C`
                                        : `Max total delta ±${formatNumber(controlGuidance.max_delta_temp_C, 1, locale)}°C`}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>

                <section className={sectionPanelClass}>
                    <div className="mb-3 flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                        <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.sensitivity}</h4>
                    </div>
                    <div className="space-y-3">
                        {sensitivityRows.map((row) => (
                            <div key={`${row.control}-${row.target}`}>
                                <div className="mb-1 flex items-center justify-between text-xs text-[color:var(--sg-text)]">
                                    <span>{getSensitivityControlLabel(row.control, locale, crop)} → {getSensitivityTargetLabel(row.target, locale, crop)}</span>
                                    <span>{formatNumber(row.elasticity, 2, locale)}</span>
                                </div>
                                <div className="h-2 rounded-full bg-[color:var(--sg-surface-muted)]">
                                    <div
                                        className={`h-2 rounded-full ${row.direction === 'increase' ? 'bg-[color:var(--sg-accent-violet)]' : 'bg-[color:var(--sg-accent-earth)]'}`}
                                        style={{ width: `${row.widthPct}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={sectionPanelClass}>
                    <div className="mb-3 flex items-center gap-2">
                        <CircleGauge className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                        <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.scenarios}</h4>
                    </div>
                    <div className="mb-4 rounded-lg border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)] p-3">
                        <div className="mb-3">
                            <p className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.customScenarioTitle}</p>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.customScenarioBody}</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.customLabel}</span>
                                <input
                                    aria-label={copy.customLabel}
                                    className="sg-field-input mt-2"
                                    disabled={telemetryOptimizationBlocked}
                                    placeholder={defaultCustomLabel}
                                    value={customScenarioDraft.label}
                                    onChange={(event) => setCustomScenarioDraft((current) => ({ ...current, label: event.target.value }))}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.dayHeating}</span>
                                <input
                                    aria-label={`${copy.dayHeating} custom`}
                                    inputMode="decimal"
                                    disabled={telemetryOptimizationBlocked || actuatorAvailability?.heating === false}
                                    className="sg-field-input mt-2"
                                    value={customScenarioDraft.dayHeatingMinTempC}
                                    onChange={(event) => setCustomScenarioDraft((current) => ({ ...current, dayHeatingMinTempC: event.target.value }))}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.nightHeating}</span>
                                <input
                                    aria-label={`${copy.nightHeating} custom`}
                                    inputMode="decimal"
                                    disabled={telemetryOptimizationBlocked || actuatorAvailability?.heating === false}
                                    className="sg-field-input mt-2"
                                    value={customScenarioDraft.nightHeatingMinTempC}
                                    onChange={(event) => setCustomScenarioDraft((current) => ({ ...current, nightHeatingMinTempC: event.target.value }))}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.dayCooling}</span>
                                <input
                                    aria-label={`${copy.dayCooling} custom`}
                                    inputMode="decimal"
                                    disabled={telemetryOptimizationBlocked || actuatorAvailability?.cooling === false}
                                    className="sg-field-input mt-2"
                                    value={customScenarioDraft.dayCoolingTargetC}
                                    onChange={(event) => setCustomScenarioDraft((current) => ({ ...current, dayCoolingTargetC: event.target.value }))}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.nightCooling}</span>
                                <input
                                    aria-label={`${copy.nightCooling} custom`}
                                    inputMode="decimal"
                                    disabled={telemetryOptimizationBlocked || actuatorAvailability?.cooling === false}
                                    className="sg-field-input mt-2"
                                    value={customScenarioDraft.nightCoolingTargetC}
                                    onChange={(event) => setCustomScenarioDraft((current) => ({ ...current, nightCoolingTargetC: event.target.value }))}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.ventBias}</span>
                                <input
                                    aria-label={`${copy.ventBias} custom`}
                                    inputMode="decimal"
                                    disabled={telemetryOptimizationBlocked || actuatorAvailability?.ventilation === false}
                                    className="sg-field-input mt-2"
                                    value={customScenarioDraft.ventBiasC}
                                    onChange={(event) => setCustomScenarioDraft((current) => ({ ...current, ventBiasC: event.target.value }))}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.screenBias}</span>
                                <input
                                    aria-label={`${copy.screenBias} custom`}
                                    inputMode="decimal"
                                    disabled={telemetryOptimizationBlocked || actuatorAvailability?.thermal_screen === false}
                                    className="sg-field-input mt-2"
                                    value={customScenarioDraft.screenBiasPct}
                                    onChange={(event) => setCustomScenarioDraft((current) => ({ ...current, screenBiasPct: event.target.value }))}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.circulationFan}</span>
                                <input
                                    aria-label={`${copy.circulationFan} custom`}
                                    inputMode="decimal"
                                    disabled={telemetryOptimizationBlocked || actuatorAvailability?.circulation_fan === false}
                                    className="sg-field-input mt-2"
                                    value={customScenarioDraft.circulationFanPct}
                                    onChange={(event) => setCustomScenarioDraft((current) => ({ ...current, circulationFanPct: event.target.value }))}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.co2Target}</span>
                                <input
                                    aria-label={`${copy.co2Target} custom`}
                                    inputMode="decimal"
                                    disabled={telemetryOptimizationBlocked || actuatorAvailability?.co2 === false}
                                    className="sg-field-input mt-2"
                                    value={customScenarioDraft.co2TargetPpm}
                                    onChange={(event) => setCustomScenarioDraft((current) => ({ ...current, co2TargetPpm: event.target.value }))}
                                />
                            </label>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const parseOptionalNumber = (value: string) => {
                                        if (value.trim().length === 0) {
                                            return undefined;
                                        }
                                        const parsed = Number(value);
                                        return Number.isFinite(parsed) ? parsed : undefined;
                                    };
                                    const nextCustomScenario = hasCustomScenarioDraft
                                        ? {
                                            label: customScenarioDraft.label.trim() || defaultCustomLabel,
                                            day_heating_min_temp_C: parseOptionalNumber(customScenarioDraft.dayHeatingMinTempC),
                                            night_heating_min_temp_C: parseOptionalNumber(customScenarioDraft.nightHeatingMinTempC),
                                            day_cooling_target_C: parseOptionalNumber(customScenarioDraft.dayCoolingTargetC),
                                            night_cooling_target_C: parseOptionalNumber(customScenarioDraft.nightCoolingTargetC),
                                            vent_bias_C: parseOptionalNumber(customScenarioDraft.ventBiasC),
                                            screen_bias_pct: parseOptionalNumber(customScenarioDraft.screenBiasPct),
                                            circulation_fan_pct: parseOptionalNumber(customScenarioDraft.circulationFanPct),
                                            co2_target_ppm: parseOptionalNumber(customScenarioDraft.co2TargetPpm),
                                        }
                                        : null;
                                    setCustomScenario(nextCustomScenario);
                                    setCustomScenarioDraft(
                                        buildCustomScenarioDraft(nextCustomScenario, defaultCustomLabel),
                                    );
                                }}
                                disabled={!hasCustomScenarioDraft || telemetryOptimizationBlocked}
                                className="rounded-full bg-[color:var(--sg-accent-violet)] px-3 py-2 text-xs font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-[color:var(--sg-surface-muted)] disabled:text-[color:var(--sg-text-muted)]"
                            >
                                {copy.customApply}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setCustomScenario(null);
                                    setCustomScenarioDraft(createEmptyCustomScenarioDraft());
                                }}
                                className="rounded-full border border-[color:var(--sg-outline-soft)] px-3 py-2 text-xs font-medium text-[color:var(--sg-text)] transition hover:border-[color:var(--sg-accent-earth)] hover:bg-[color:var(--sg-surface-muted)]"
                            >
                                {copy.customReset}
                            </button>
                            {customScenario ? (
                                <span className="inline-flex items-center rounded-full bg-[color:var(--sg-accent-earth-soft)] px-3 py-1 text-[11px] font-medium text-[color:var(--sg-accent-earth)]">
                                    {getScenarioLabel(customScenario.label, locale)}
                                </span>
                            ) : null}
                        </div>
                    </div>
                    {scenarioRows.length === 0 ? (
                        <p className="text-sm text-[color:var(--sg-text-muted)]">{copy.noScenario}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs text-[color:var(--sg-text)]">
                                <thead className="text-[11px] uppercase tracking-wide text-[color:var(--sg-text-faint)]">
                                    <tr>
                                        <th className="px-2 py-2">{copy.modeHeader}</th>
                                        <th className="px-2 py-2">{copy.meanHeader}</th>
                                        <th className="px-2 py-2">{copy.nodeHeader}</th>
                                        <th className="px-2 py-2">{copy.carbonHeader}</th>
                                        <th className="px-2 py-2">{copy.riskHeader}</th>
                                        <th className="px-2 py-2">{copy.energyHeader}</th>
                                        <th className="px-2 py-2">{copy.yieldHeader}</th>
                                        <th className="px-2 py-2">{copy.laborHeader}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedScenarioRows.map((groupEntry) => (
                                        <Fragment key={`scenario-group-${groupEntry.group}`}>
                                            <tr className="border-t border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)]">
                                                <td colSpan={8} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--sg-text-muted)]">
                                                    {getScenarioGroupLabel(groupEntry.group, locale)}
                                                </td>
                                            </tr>
                                            {groupEntry.rows.map((row, index) => (
                                                <tr key={`${groupEntry.group}-${row.label}-${row.mode}-${index}`} className="border-t border-[color:var(--sg-outline-soft)]">
                                                    <td className="px-2 py-2 font-medium text-[color:var(--sg-text-strong)]">
                                                        <div>{getScenarioLabel(row.label, locale)}</div>
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getScenarioBadgeClass(row.recommendation_badge)}`}>
                                                                {getScenarioBadgeLabel(row.recommendation_badge, locale)}
                                                            </span>
                                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getYieldTrendClass(row.yield_trend)}`}>
                                                                {getYieldTrendLabel(row.yield_trend, locale)}
                                                            </span>
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                                    getReadinessDescriptor(row.confidence, locale).tone === 'success'
                                                                        ? 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]'
                                                                        : getReadinessDescriptor(row.confidence, locale).tone === 'info'
                                                                            ? 'bg-amber-100 text-amber-800'
                                                                            : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]'
                                                                }`}
                                                            >
                                                                {copy.confidence} {getReadinessDescriptor(row.confidence, locale).label}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 text-[10px] text-[color:var(--sg-text-muted)]">
                                                            {copy.dayHeating} {formatNumber(row.day_heating_min_temp_C ?? row.day_min_temp_C, 1, locale)}°C · {copy.dayCooling} {formatNumber(row.day_cooling_target_C, 1, locale)}°C
                                                        </div>
                                                        <div className="mt-1 text-[10px] text-[color:var(--sg-text-muted)]">
                                                            {copy.ventBias} {formatNumber(row.vent_bias_C, 2, locale)}°C · {copy.screenBias} {formatNumber(row.screen_bias_pct, 1, locale)}% · {copy.circulationFan} {formatNumber(row.circulation_fan_pct, 0, locale)}%
                                                        </div>
                                                        {(() => {
                                                            const visibleRiskFlags = row.risk_flags.filter((riskFlag) => !shouldHideRiskFlag(riskFlag));
                                                            if (visibleRiskFlags.length === 0) {
                                                                return null;
                                                            }

                                                            return (
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {visibleRiskFlags.slice(0, 2).map((riskFlag, riskIndex) => {
                                                                        const code = String(riskFlag.code ?? `row-risk-${riskIndex}`);
                                                                        return (
                                                                            <span key={`${row.label}-${code}-${riskIndex}`} className="rounded-full bg-[color:var(--sg-surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--sg-text)]">
                                                                                {getRiskFlagTitle(code, locale)}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-2 py-2">{formatNumber(row.mean_temp_C, 1, locale)}°C</td>
                                                    <td className="px-2 py-2">{formatNumber(row.node_rate_day, 3, locale)}</td>
                                                    <td className="px-2 py-2">
                                                        <div>{formatNumber(row.net_carbon, 3, locale)}</div>
                                                        <div className="mt-1 text-[10px] text-[color:var(--sg-text-faint)]">
                                                            {formatNumber(row.net_assimilation, 3, locale)} μmol/m²/s
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <div>{formatNumber(row.humidity_penalty, 3, locale)}</div>
                                                        <div className="mt-1 text-[10px] text-[color:var(--sg-text-faint)]">
                                                            {copy.diseaseRisk} {formatNumber(row.disease_penalty, 3, locale)}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <div>{formatNumber(row.total_energy_cost_krw_m2_day, 0, locale)} {locale === 'ko' ? '원' : 'KRW'}</div>
                                                        <div className="mt-1 text-[10px] text-[color:var(--sg-text-faint)]">
                                                            {copy.heatingEnergy} {formatNumber(row.heating_energy_kwh_m2_day, 2, locale)} · {copy.coolingEnergy} {formatNumber(row.cooling_energy_kwh_m2_day, 2, locale)}
                                                        </div>
                                                        {row.actual_area_projection ? (
                                                            <div className="mt-1 text-[10px] text-[color:var(--sg-text-faint)]">
                                                                {locale === 'ko'
                                                                    ? `실면적 ${formatNumber(row.actual_area_projection.energy_kwh_day, 1, locale)} kWh/일 · ${formatNumber(row.actual_area_projection.energy_krw_day, 0, locale)} 원/일`
                                                                    : `${formatNumber(row.actual_area_projection.energy_kwh_day, 1, locale)} kWh/day · ${formatNumber(row.actual_area_projection.energy_krw_day, 0, locale)} KRW/day`}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <div>{formatNumber(row.yield_kg_m2_day, 3, locale)} kg/m²/day</div>
                                                        <div className="mt-1 text-[10px] text-[color:var(--sg-text-faint)]">
                                                            Δ {formatNumber(row.harvest_trend_delta_pct, 1, locale)}%
                                                        </div>
                                                        {row.actual_area_projection ? (
                                                            <div className="mt-1 text-[10px] text-[color:var(--sg-text-faint)]">
                                                                {locale === 'ko'
                                                                    ? `실면적 ${formatNumber(row.actual_area_projection.yield_kg_day, 1, locale)} kg/일 · ${formatNumber(row.actual_area_projection.yield_kg_week, 1, locale)} kg/주`
                                                                    : `${formatNumber(row.actual_area_projection.yield_kg_day, 1, locale)} kg/day · ${formatNumber(row.actual_area_projection.yield_kg_week, 1, locale)} kg/week`}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <div>{formatNumber(row.labor_index, 3, locale)}</div>
                                                        {row.actual_area_projection ? (
                                                            <div className="mt-1 text-[10px] text-[color:var(--sg-text-faint)]">
                                                                {locale === 'ko'
                                                                    ? `실면적 ${formatNumber(row.actual_area_projection.labor_cost_krw_day, 0, locale)} 원/일`
                                                                    : `${formatNumber(row.actual_area_projection.labor_cost_krw_day, 0, locale)} KRW/day`}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <Suspense
                    fallback={(
                        <div className={`${sectionPanelClass} text-xs text-[color:var(--sg-text-muted)]`}>
                            {locale === 'ko' ? '보정 작업 공간을 불러오는 중입니다.' : 'Loading calibration workspace...'}
                        </div>
                    )}
                >
                    <RTRCalibrationWorkspace key={crop} crop={crop} onSaved={refreshCalibrationConsumers} />
                </Suspense>

                <details className="rounded-xl border border-[color:var(--sg-outline-soft)] p-3">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--sg-text-strong)]">
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
                            profileError={profileErrorCopy}
                            compact
                        />
                    </div>
                </details>

                {(optimizerLoading || loading) ? (
                    <div className="text-xs text-[color:var(--sg-text-muted)]">{copy.computing}</div>
                ) : null}
            </div>
        </div>
    );
};

const RTROptimizerPanelStandalone = (props: RTROptimizerPanelProps) => {
    const { areaByCrop } = useAreaUnit();
    const {
        crop,
        profile,
        profileLoading,
        optimizerEnabled: optimizerEnabledProp,
        defaultMode: defaultModeProp,
        telemetryStatus = 'live',
    } = props;
    const areaState = areaByCrop[crop];
    const optimizerEnabled = profileLoading ? false : (profile?.optimizer?.enabled ?? optimizerEnabledProp ?? false);
    const defaultMode = defaultModeProp ?? profile?.optimizer?.default_mode ?? DEFAULT_OPTIMIZATION_MODE;
    const optimizerState = useRtrOptimizer({
        crop,
        actualAreaM2: areaState.actualAreaM2,
        actualAreaPyeong: areaState.actualAreaPyeong,
        actualAreaSource: areaState.source,
        optimizerEnabled,
        defaultMode,
        telemetryStatus,
    });
    return <RTROptimizerPanelContent {...props} telemetryStatus={telemetryStatus} optimizerState={optimizerState} uiState={props.uiState} />;
};

const RTROptimizerPanel = (props: RTROptimizerPanelProps) => {
    if (props.optimizerState) {
        return <RTROptimizerPanelContent {...props} telemetryStatus={props.telemetryStatus ?? 'live'} optimizerState={props.optimizerState} uiState={props.uiState} />;
    }
    return <RTROptimizerPanelStandalone {...props} />;
};

export default RTROptimizerPanel;
