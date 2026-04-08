import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    CropType,
    RtrOptimizeResponse,
    RtrProfile,
    RtrScenarioResponse,
    RtrSensitivityResponse,
    RtrStateResponse,
    SensorData,
    TemperatureSettings,
    TelemetryStatus,
} from '../types';
import { AreaUnitProvider } from '../context/AreaUnitContext';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../i18n/locale';
import RTROptimizerPanel from './RTROptimizerPanel';

const useRtrOptimizerMock = vi.fn();

vi.mock('../hooks/useRtrOptimizer', () => ({
    useRtrOptimizer: (options: unknown) => useRtrOptimizerMock(options),
}));

vi.mock('./RTROutlookPanel', () => ({
    default: () => <div>기준선 비교 카드 내용</div>,
}));

vi.mock('./RTRCalibrationWorkspace', () => ({
    default: ({ onSaved }: { onSaved?: () => void | Promise<void> }) => (
        <div>
            <div>RTR calibration workspace stub</div>
            <button type="button" onClick={() => void onSaved?.()}>
                calibration saved
            </button>
        </div>
    ),
}));

const SENSOR_FIXTURE: SensorData = {
    timestamp: Date.now(),
    temperature: 19.2,
    canopyTemp: 19.5,
    humidity: 81,
    co2: 620,
    light: 420,
    soilMoisture: 54,
    vpd: 0.86,
    transpiration: 2.8,
    stomatalConductance: 0.33,
    photosynthesis: 18.4,
    hFlux: 52,
    leFlux: 93,
    energyUsage: 12.7,
};

const TEMPERATURE_SETTINGS: TemperatureSettings = {
    heating: 18,
    cooling: 24,
};

function buildStateResponse(crop: CropType = 'Cucumber'): RtrStateResponse {
    return {
        status: 'ready',
        crop,
        greenhouse_id: 'house-a',
        snapshot_id: 'snap-001',
        optimizer_enabled: true,
        area_unit_meta: {
            greenhouse_area_m2: 3305.8,
            actual_area_m2: 2809.92,
            actual_area_pyeong: 850,
        },
        baseline_rtr: {
            baseTempC: 18.132,
            slopeCPerMjM2: 0.3099,
            baseline_target_C: 19.1,
        },
        canonical_state: {
            timestamp: '2026-04-08T03:00:00Z',
            crop,
            greenhouse_id: 'house-a',
            env: {
                T_air_C: 19.2,
                T_canopy_C: 19.5,
                RH_pct: 81,
                VPD_kPa: 0.86,
                CO2_ppm: 620,
                PAR_umol_m2_s: 420,
                outside_T_C: 11.3,
            },
            flux: {
                gross_assim_umol_m2_s: 21.3,
                net_assim_umol_m2_s: 18.2,
                respiration_proxy_umol_m2_s: 3.1,
                transpiration_g_m2_s: 2.8,
                latent_heat_W_m2: 93,
                sensible_heat_W_m2: 52,
                stomatal_conductance_m_s: 0.33,
            },
            growth: {
                LAI: 1.74,
                node_count: 24,
                predicted_node_rate_day: 0.63,
                fruit_load: 14.5,
                sink_demand: 2.3,
                source_capacity: 2.8,
                vegetative_dry_matter_g_m2: 1420,
                fruit_dry_matter_g_m2: 915,
                harvested_fruit_dry_matter_g_m2: 520,
            },
            crop_specific: {
                cucumber: {
                    leaf_area_by_rank: [0.12, 0.15, 0.16],
                    upper_leaf_activity: 0.91,
                    middle_leaf_activity: 0.72,
                    bottom_leaf_activity: 0.38,
                    remaining_leaves: 16,
                },
            },
            energy: {
                Q_load_kW: 41.2,
                P_elec_kW: 12.4,
                COP_current: 3.3,
                daily_kWh: 298.5,
            },
            events: {
                recent_leaf_removal: [
                    {
                        event_time: '2026-04-07T02:00:00Z',
                        leaves_removed_count: 2,
                    },
                ],
                recent_fruit_thinning: [],
                recent_harvest: [],
                recent_setpoint_changes: [],
            },
            baseline_rtr: {
                baseTempC: 18.132,
                slopeCPerMjM2: 0.3099,
                baseline_target_C: 19.1,
            },
        },
    };
}

function buildOptimizeResponse(): RtrOptimizeResponse {
    return {
        status: 'ready',
        mode: 'optimizer',
        crop: 'Cucumber',
        greenhouse_id: 'house-a',
        snapshot_id: 'snap-001',
        baseline: {
            mode: 'baseline',
            targets: {
                day_min_temp_C: 19.4,
                night_min_temp_C: 18.2,
                mean_temp_C: 19.1,
                vent_bias_C: 0.1,
                screen_bias_pct: 4,
                co2_target_ppm: 650,
            },
            objective_breakdown: {
                assimilation_gain: 0,
                respiration_cost: 0,
                node_target_penalty: 0.04,
                carbon_margin_penalty: 0.02,
                sink_overload_penalty: 0.08,
                humidity_risk_penalty: 0.01,
                disease_penalty: 0.01,
                energy_cost: 2.4,
                energy_cost_krw: 290,
                labor_cost: 0.14,
                labor_index: 0.42,
            },
            feasibility: {
                target_node_hit: false,
                carbon_margin_positive: true,
                risk_flags: [],
                confidence: 0.74,
            },
        },
        optimal_targets: {
            day_min_temp_C: 20,
            night_min_temp_C: 18.4,
            mean_temp_C: 19.5,
            vent_bias_C: 0.2,
            screen_bias_pct: 5,
            co2_target_ppm: 700,
        },
        rtr_equivalent: {
            baseline_ratio: 1,
            optimized_ratio: 1.02,
            delta_ratio: 0.02,
            delta_temp_C: 0.4,
        },
        objective_breakdown: {
            assimilation_gain: 0.36,
            respiration_cost: 0.11,
            node_target_penalty: 0,
            carbon_margin_penalty: 0,
            sink_overload_penalty: 0.07,
            humidity_risk_penalty: 0.03,
            disease_penalty: 0.02,
            energy_cost: 2.9,
            energy_cost_krw: 348,
            labor_cost: 0.22,
            labor_index: 0.57,
        },
        feasibility: {
            target_node_hit: true,
            carbon_margin_positive: true,
            risk_flags: [],
            confidence: 0.86,
        },
        flux_projection: {
            gross_assim_umol_m2_s: 22.4,
            net_assim_umol_m2_s: 18.7,
            respiration_umol_m2_s: 3.7,
            carbon_margin: 0.21,
            day_Q_load_kW: 9.2,
            night_Q_load_kW: 6.4,
            stomatal_conductance_m_s: 0.34,
        },
        crop_specific_insight: {
            crop: 'cucumber',
            remaining_leaves: 16,
            leaf_area_by_rank: [0.12, 0.15, 0.16],
            layer_activity: {
                upper: 0.91,
                middle: 0.72,
                bottom: 0.38,
            },
            bottleneck_layer: 'bottom',
            recent_leaf_removal_count: 1,
        },
        warning_badges: [
            'risk_bound_active',
            'large_rtr_deviation_reason_required',
        ],
        units_m2: {
            greenhouse_area_m2: 3305.8,
            actual_area_m2: 2809.92,
            actual_area_pyeong: 850,
            yield_proxy_kg_m2_day: 0.043,
            yield_proxy_kg_m2_week: 0.301,
            energy_kwh_m2_day: 2.9,
            energy_krw_m2_day: 348,
            labor_index_m2_day: 0.57,
            node_development_day: 0.68,
        },
        actual_area_projection: {
            actual_area_m2: 2809.92,
            actual_area_pyeong: 850,
            yield_kg_day: 120.8,
            yield_kg_week: 845.6,
            energy_kwh_day: 8140.2,
            energy_krw_day: 977880,
            labor_index_day: 1601.65,
        },
        explanation_payload: {
            summary: '목표 마디 전개를 맞추기 위해 기준선보다 소폭 높은 평균 온도가 필요합니다.',
            target_node_development_per_day: 0.68,
            baseline_mean_temp_C: 19.1,
            optimized_mean_temp_C: 19.5,
            reason_tags: [
                'temperature-up',
                'node-target-guarded',
                'energy-tradeoff',
            ],
            crop_summary: '하위엽 기여가 낮아 온도를 크게 올리기보다 소폭 상향에 그칩니다.',
            missing_work_event_warning: '최근 적엽 기록이 부족하면 해석 신뢰도가 낮아질 수 있습니다.',
        },
        control_guidance: {
            target_horizon: 'today',
            day_hold_hours: 14,
            night_hold_hours: 10,
            change_limit_C_per_step: 0.12,
            max_delta_temp_C: 1.2,
            max_rtr_ratio_delta: 0.03,
        },
        solver: {
            success: true,
            message: 'ok',
            method: 'bounded-search',
        },
    };
}

function buildScenarioResponse(): RtrScenarioResponse {
    const baselineBreakdown = {
        assimilation_gain: 0.18,
        respiration_cost: 0.09,
        node_target_penalty: 0.04,
        carbon_margin_penalty: 0.02,
        sink_overload_penalty: 0.08,
        humidity_risk_penalty: 0.01,
        disease_penalty: 0.01,
        energy_cost: 2.4,
        energy_cost_krw: 290,
        labor_cost: 0.14,
        labor_index: 0.42,
    };
    const balancedBreakdown = {
        assimilation_gain: 0.36,
        respiration_cost: 0.11,
        node_target_penalty: 0,
        carbon_margin_penalty: 0,
        sink_overload_penalty: 0.07,
        humidity_risk_penalty: 0.03,
        disease_penalty: 0.02,
        energy_cost: 2.9,
        energy_cost_krw: 348,
        labor_cost: 0.22,
        labor_index: 0.57,
    };

    return {
        status: 'ready',
        crop: 'Cucumber',
        greenhouse_id: 'house-a',
        snapshot_id: 'snap-001',
        target_node_development_per_day: 0.68,
        area_unit_meta: {
            greenhouse_area_m2: 3305.8,
            actual_area_m2: 2809.92,
            actual_area_pyeong: 850,
        },
        scenarios: [
            {
                label: 'baseline',
                mode: 'baseline',
                mean_temp_C: 19.1,
                day_min_temp_C: 19.4,
                night_min_temp_C: 18.2,
                node_rate_day: 0.61,
                net_carbon: 0.19,
                respiration: 0.09,
                energy_kwh_m2_day: 2.4,
                labor_index: 0.42,
                yield_kg_m2_day: 0.036,
                yield_kg_m2_week: 0.252,
                yield_trend: 'stable',
                recommendation_badge: 'baseline',
                confidence: 0.74,
                risk_flags: [],
                objective_breakdown: baselineBreakdown,
                actual_area_projection: {
                    actual_area_m2: 2809.92,
                    actual_area_pyeong: 850,
                    yield_kg_day: 101.16,
                    yield_kg_week: 708.12,
                    energy_kwh_day: 6743.81,
                    energy_krw_day: 814876.8,
                    labor_index_day: 1180.17,
                },
            },
            {
                label: 'offset_plus_0_3c',
                mode: 'offset',
                mean_temp_C: 19.4,
                day_min_temp_C: 19.7,
                night_min_temp_C: 18.5,
                node_rate_day: 0.65,
                net_carbon: 0.23,
                respiration: 0.1,
                energy_kwh_m2_day: 2.7,
                labor_index: 0.5,
                yield_kg_m2_day: 0.04,
                yield_kg_m2_week: 0.28,
                yield_trend: 'up',
                recommendation_badge: 'compare',
                confidence: 0.8,
                risk_flags: [],
                objective_breakdown: balancedBreakdown,
                actual_area_projection: {
                    actual_area_m2: 2809.92,
                    actual_area_pyeong: 850,
                    yield_kg_day: 112.4,
                    yield_kg_week: 786.8,
                    energy_kwh_day: 7586.78,
                    energy_krw_day: 910414.08,
                    labor_index_day: 1404.96,
                },
            },
            {
                label: 'balanced',
                mode: 'optimizer',
                mean_temp_C: 19.5,
                day_min_temp_C: 20,
                night_min_temp_C: 18.4,
                node_rate_day: 0.68,
                net_carbon: 0.25,
                respiration: 0.11,
                energy_kwh_m2_day: 2.9,
                labor_index: 0.57,
                yield_kg_m2_day: 0.043,
                yield_kg_m2_week: 0.301,
                yield_trend: 'up',
                recommendation_badge: 'recommended',
                confidence: 0.86,
                risk_flags: [],
                objective_breakdown: balancedBreakdown,
                actual_area_projection: {
                    actual_area_m2: 2809.92,
                    actual_area_pyeong: 850,
                    yield_kg_day: 120.8,
                    yield_kg_week: 845.6,
                    energy_kwh_day: 8140.2,
                    energy_krw_day: 977880,
                    labor_index_day: 1601.65,
                },
            },
        ],
    };
}

function buildSensitivityResponse(): RtrSensitivityResponse {
    return {
        status: 'ready',
        mode: 'optimizer',
        crop: 'Cucumber',
        greenhouse_id: 'house-a',
        snapshot_id: 'snap-001',
        target_horizon: 'today',
        step_c: 0.3,
        optimized_targets: {
            day_min_temp_C: 20,
            night_min_temp_C: 18.4,
            mean_temp_C: 19.5,
            vent_bias_C: 0.2,
            screen_bias_pct: 5,
            co2_target_ppm: 700,
        },
        area_unit_meta: {
            greenhouse_area_m2: 3305.8,
            actual_area_m2: 2809.92,
            actual_area_pyeong: 850,
        },
        sensitivities: [
            {
                control: 'temperature_day',
                target: 'predicted_node_rate_day',
                derivative: 0.08,
                elasticity: 0.22,
                direction: 'increase',
                trust_region: { low: -0.3, high: 0.3 },
                method: 'finite_difference',
                perturbation_size: 0.3,
                valid: true,
                scenario_alignment: true,
            },
            {
                control: 'temperature_night',
                target: 'energy_cost',
                derivative: 0.12,
                elasticity: 0.16,
                direction: 'increase',
                trust_region: { low: -0.3, high: 0.3 },
                method: 'finite_difference',
                perturbation_size: 0.3,
                valid: true,
                scenario_alignment: true,
            },
            {
                control: 'screen_bias',
                target: 'humidity_risk_penalty',
                derivative: -0.05,
                elasticity: -0.12,
                direction: 'decrease',
                trust_region: { low: -3, high: 3 },
                method: 'finite_difference',
                perturbation_size: 3,
                valid: true,
                scenario_alignment: true,
            },
        ],
    };
}

function buildProfile(optimizerEnabled = true): RtrProfile {
    return {
        crop: 'Cucumber',
        strategyLabel: 'Cucumber RTR',
        sourceNote: 'test profile',
        lightToRadiantDivisor: 218,
        baseTempC: 18.132,
        slopeCPerMjM2: 0.3099,
        toleranceC: 1,
        calibration: {
            mode: 'baseline',
            sampleDays: 14,
            fitStartDate: null,
            fitEndDate: null,
            minCoverageHours: 12,
            rSquared: null,
            meanAbsoluteErrorC: null,
            selectionSource: 'heuristic-fallback',
        },
        optimizer: {
            enabled: optimizerEnabled,
            default_mode: 'balanced',
            max_delta_temp_C: 1.2,
            max_rtr_ratio_delta: 0.03,
            temp_slew_rate_C_per_step: 0.12,
            weights: {
                temp: 1,
                node: 150,
                carbon: 120,
                sink: 80,
                resp: 20,
                risk: 120,
                energy: 25,
                labor: 20,
            },
        },
    };
}

function renderPanel(options?: {
    locale?: 'ko' | 'en';
    optimizerEnabled?: boolean;
    profile?: RtrProfile | null;
    profileLoading?: boolean;
    telemetryStatus?: TelemetryStatus;
    onRefreshProfiles?: () => void | Promise<void>;
}) {
    if (options?.locale) {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, options.locale);
    }
    const optimizerEnabled = options?.optimizerEnabled ?? true;
    return render(
        <LocaleProvider>
            <AreaUnitProvider>
                <RTROptimizerPanel
                    crop="Cucumber"
                    currentData={SENSOR_FIXTURE}
                    history={[SENSOR_FIXTURE]}
                    telemetryStatus={options?.telemetryStatus}
                    temperatureSettings={TEMPERATURE_SETTINGS}
                    weather={null}
                    loading={false}
                    error={null}
                    profile={options?.profile ?? buildProfile(optimizerEnabled)}
                    profileLoading={options?.profileLoading ?? false}
                    profileError={null}
                    optimizerEnabled={optimizerEnabled}
                    onRefreshProfiles={options?.onRefreshProfiles}
                />
            </AreaUnitProvider>
        </LocaleProvider>,
    );
}

describe('RTROptimizerPanel', () => {
    beforeEach(() => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ko');
        useRtrOptimizerMock.mockReset();
        useRtrOptimizerMock.mockReturnValue({
            stateResponse: buildStateResponse(),
            optimizeResponse: buildOptimizeResponse(),
            scenarioResponse: buildScenarioResponse(),
            sensitivityResponse: buildSensitivityResponse(),
            targetNodeDevelopmentPerDay: 0.68,
            setTargetNodeDevelopmentPerDay: vi.fn(),
            optimizationMode: 'balanced',
            setOptimizationMode: vi.fn(),
            customScenario: null,
            setCustomScenario: vi.fn(),
            includeEnergyCost: true,
            setIncludeEnergyCost: vi.fn(),
            includeLaborCost: true,
            setIncludeLaborCost: vi.fn(),
            telemetryOptimizationBlocked: false,
            loading: false,
            loadingState: false,
            loadingOptimize: false,
            error: null,
            refreshState: vi.fn(),
            refreshOptimization: vi.fn(),
        });
    });

    it('renders optimizer summary, projections, scenario compare, and reason badges in Korean', async () => {
        renderPanel();

        expect(await screen.findByText('RTR 최적화')).toBeTruthy();
        expect(screen.getByText('실평수 환산')).toBeTruthy();
        expect(screen.getByText('총 수확량 / 일')).toBeTruthy();
        expect(screen.getByText('총 수확량 / 주')).toBeTruthy();
        expect(screen.getByText('목표 마디 전개')).toBeTruthy();
        expect(screen.getByText('기준선보다 온도 상향')).toBeTruthy();
        expect(screen.getByText('목표 마디 속도 방어')).toBeTruthy();
        expect(screen.getByText('에너지 비용 고려')).toBeTruthy();
        expect(screen.getByText('위험 제약 적용 중')).toBeTruthy();
        expect(screen.getByText('RTR 편차 이유 설명 필요')).toBeTruthy();
        expect(screen.getByText('시나리오 비교')).toBeTruthy();
        expect(screen.getAllByText('균형').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('기준선').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('기준선 +0.3°C')).toBeTruthy();
        expect(screen.getAllByText('스크린 편차').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('스크린 편차 → 습도 위험 패널티')).toBeTruthy();
        expect(screen.getByText('RTR calibration workspace stub')).toBeTruthy();
        expect(screen.getByText('기준선 비교 카드')).toBeTruthy();
        expect(screen.getByText('기준선 비교 카드 내용')).toBeTruthy();
        expect(screen.getByText('실면적 120.8 kg/일 · 845.6 kg/주')).toBeTruthy();
        expect(screen.getByText('실면적 8,140.2 kWh/일 · 977,880 원/일')).toBeTruthy();
    });

    it('refreshes profiles and optimizer state after calibration save completes', async () => {
        const refreshProfiles = vi.fn();
        const refreshState = vi.fn().mockResolvedValue(undefined);
        const refreshOptimization = vi.fn().mockResolvedValue(undefined);
        useRtrOptimizerMock.mockReturnValue({
            stateResponse: buildStateResponse(),
            optimizeResponse: buildOptimizeResponse(),
            scenarioResponse: buildScenarioResponse(),
            sensitivityResponse: buildSensitivityResponse(),
            targetNodeDevelopmentPerDay: 0.68,
            setTargetNodeDevelopmentPerDay: vi.fn(),
            optimizationMode: 'balanced',
            setOptimizationMode: vi.fn(),
            customScenario: null,
            setCustomScenario: vi.fn(),
            includeEnergyCost: true,
            setIncludeEnergyCost: vi.fn(),
            includeLaborCost: true,
            setIncludeLaborCost: vi.fn(),
            telemetryOptimizationBlocked: false,
            loading: false,
            loadingState: false,
            loadingOptimize: false,
            error: null,
            refreshState,
            refreshOptimization,
        });

        renderPanel({ onRefreshProfiles: refreshProfiles });

        fireEvent.click(await screen.findByRole('button', { name: 'calibration saved' }));

        await waitFor(() => {
            expect(refreshProfiles).toHaveBeenCalledTimes(1);
            expect(refreshState).toHaveBeenCalledTimes(1);
            expect(refreshOptimization).toHaveBeenCalledTimes(1);
        });
    });

    it('syncs server area meta into context and reruns the optimizer with user area overrides', async () => {
        renderPanel();

        await waitFor(() => {
            expect(useRtrOptimizerMock).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    crop: 'Cucumber',
                    actualAreaPyeong: 850,
                    actualAreaM2: 2809.92,
                }),
            );
        });

        const pyeongInput = screen.getByLabelText('실평수') as HTMLInputElement;
        fireEvent.change(pyeongInput, { target: { value: '900' } });

        await waitFor(() => {
            expect(useRtrOptimizerMock).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    crop: 'Cucumber',
                    actualAreaPyeong: 900,
                    actualAreaM2: 2975.21,
                }),
            );
        });

        expect((screen.getByLabelText('실평수') as HTMLInputElement).value).toBe('900');
        expect((screen.getByLabelText('실면적 (m²)') as HTMLInputElement).value).toBe('2975.21');
    });

    it('renders English explanation and placeholders without leaking Korean narrative', async () => {
        renderPanel({ locale: 'en' });

        expect(await screen.findByText('RTR optimizer')).toBeTruthy();
        expect(screen.getByText(/The optimizer raised mean temperature by 0\.40°C/)).toBeTruthy();
        expect(screen.queryByText('목표 마디 전개를 맞추기 위해 기준선보다 소폭 높은 평균 온도가 필요합니다.')).toBeNull();
        expect(screen.getByPlaceholderText('e.g. 850')).toBeTruthy();
        expect(screen.getByPlaceholderText('e.g. 2809.9')).toBeTruthy();
    });

    it('falls back to the baseline monitor when the optimizer is disabled', async () => {
        renderPanel({ locale: 'en', optimizerEnabled: false });

        expect(await screen.findByText('Baseline RTR monitor')).toBeTruthy();
        expect(screen.getByText('This profile keeps the optimizer disabled, so only the baseline RTR monitor is shown.')).toBeTruthy();
        expect(screen.getByText('기준선 비교 카드 내용')).toBeTruthy();
        expect(screen.queryByText('RTR optimizer')).toBeNull();
    });

    it('holds a loading shell until the RTR profile contract is ready', async () => {
        render(
            <LocaleProvider>
                <AreaUnitProvider>
                    <RTROptimizerPanel
                        crop="Cucumber"
                        currentData={SENSOR_FIXTURE}
                        history={[SENSOR_FIXTURE]}
                        temperatureSettings={TEMPERATURE_SETTINGS}
                        weather={null}
                        loading={false}
                        error={null}
                        profile={null}
                        profileLoading
                        profileError={null}
                    />
                </AreaUnitProvider>
            </LocaleProvider>,
        );

        expect(await screen.findByText('RTR 프로파일 준비 중')).toBeTruthy();
        expect(screen.getByText('프로파일 설정을 확인한 뒤 RTR 최적화 컨트롤을 열어 드립니다.')).toBeTruthy();
        expect(screen.queryByText('목표 마디 전개')).toBeNull();
    });

    it('keeps unknown scenario labels verbatim instead of remapping them to built-in modes', async () => {
        const scenarioResponse = buildScenarioResponse();
        scenarioResponse.scenarios.push({
            label: 'Custom +0.6°C',
            mode: 'custom',
            mean_temp_C: 19.7,
            day_min_temp_C: 20.2,
            night_min_temp_C: 18.6,
            node_rate_day: 0.69,
            net_carbon: 0.24,
            respiration: 0.12,
            energy_kwh_m2_day: 3.1,
            labor_index: 0.61,
            yield_kg_m2_day: 0.045,
            yield_kg_m2_week: 0.315,
            yield_trend: 'up',
            recommendation_badge: 'compare',
            confidence: 0.81,
            risk_flags: [],
            objective_breakdown: buildOptimizeResponse().objective_breakdown,
            actual_area_projection: {
                actual_area_m2: 2809.92,
                actual_area_pyeong: 850,
                yield_kg_day: 126.45,
                yield_kg_week: 885.15,
                energy_kwh_day: 8710.75,
                energy_krw_day: 1043502,
                labor_index_day: 1714.05,
            },
        });

        useRtrOptimizerMock.mockReturnValue({
            stateResponse: buildStateResponse(),
            optimizeResponse: buildOptimizeResponse(),
            scenarioResponse,
            sensitivityResponse: buildSensitivityResponse(),
            targetNodeDevelopmentPerDay: 0.68,
            setTargetNodeDevelopmentPerDay: vi.fn(),
            optimizationMode: 'balanced',
            setOptimizationMode: vi.fn(),
            customScenario: null,
            setCustomScenario: vi.fn(),
            includeEnergyCost: true,
            setIncludeEnergyCost: vi.fn(),
            includeLaborCost: true,
            setIncludeLaborCost: vi.fn(),
            telemetryOptimizationBlocked: true,
            loading: false,
            loadingState: false,
            loadingOptimize: false,
            error: null,
            refreshState: vi.fn(),
            refreshOptimization: vi.fn(),
        });

        renderPanel();

        expect(await screen.findByText('Custom +0.6°C')).toBeTruthy();
    });
    it('renders stale telemetry warnings, risk details, and scenario badges in English', async () => {
        const optimizeResponse = buildOptimizeResponse();
        optimizeResponse.feasibility.risk_flags = [
            {
                code: 'disease_risk_high',
                severity: 'high',
                message: 'Resulting RH exceeds the bounded disease-risk ceiling.',
                control: 'rh_target',
            },
        ];

        useRtrOptimizerMock.mockReturnValue({
            stateResponse: buildStateResponse(),
            optimizeResponse,
            scenarioResponse: buildScenarioResponse(),
            sensitivityResponse: buildSensitivityResponse(),
            targetNodeDevelopmentPerDay: 0.68,
            setTargetNodeDevelopmentPerDay: vi.fn(),
            optimizationMode: 'balanced',
            setOptimizationMode: vi.fn(),
            customScenario: null,
            setCustomScenario: vi.fn(),
            includeEnergyCost: true,
            setIncludeEnergyCost: vi.fn(),
            includeLaborCost: true,
            setIncludeLaborCost: vi.fn(),
            telemetryOptimizationBlocked: false,
            loading: false,
            loadingState: false,
            loadingOptimize: false,
            error: null,
            refreshState: vi.fn(),
            refreshOptimization: vi.fn(),
        });

        renderPanel({ locale: 'en', telemetryStatus: 'stale' });

        expect(await screen.findByText('RTR optimizer')).toBeTruthy();
        expect(screen.getByText(/Sensor telemetry is stale/)).toBeTruthy();
        expect(screen.getByText('Constraint and risk warnings')).toBeTruthy();
        expect(screen.getByText('Disease-risk humidity')).toBeTruthy();
        expect(screen.getByText('Sink overload risk')).toBeTruthy();
        expect(screen.getByText('Hold time')).toBeTruthy();
        expect(screen.getByText('Change limit')).toBeTruthy();
        expect(screen.getAllByText('Recommended').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Yield up').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('8,140.2 kWh/day @ actual area')).toBeTruthy();
    });

    it('gates the optimizer UI and falls back to baseline compare when telemetry is offline', async () => {
        useRtrOptimizerMock.mockReturnValue({
            stateResponse: buildStateResponse(),
            optimizeResponse: null,
            scenarioResponse: null,
            sensitivityResponse: null,
            targetNodeDevelopmentPerDay: 0.68,
            setTargetNodeDevelopmentPerDay: vi.fn(),
            optimizationMode: 'balanced',
            setOptimizationMode: vi.fn(),
            customScenario: null,
            setCustomScenario: vi.fn(),
            includeEnergyCost: true,
            setIncludeEnergyCost: vi.fn(),
            includeLaborCost: true,
            setIncludeLaborCost: vi.fn(),
            telemetryOptimizationBlocked: true,
            loading: false,
            loadingState: false,
            loadingOptimize: false,
            error: null,
            refreshState: vi.fn(),
            refreshOptimization: vi.fn(),
        });

        renderPanel({ telemetryStatus: 'offline' });

        expect(await screen.findByText('실시간 수신이 오래돼 RTR 최적화를 잠시 제한합니다.')).toBeTruthy();
        expect(screen.getByText('기준선 비교 카드 내용')).toBeTruthy();
        expect(screen.queryByText('목표 마디 전개')).toBeNull();
    });

    it('commits a custom compare scenario when manual setpoints are applied', async () => {
        const setCustomScenario = vi.fn();
        useRtrOptimizerMock.mockReturnValue({
            stateResponse: buildStateResponse(),
            optimizeResponse: buildOptimizeResponse(),
            scenarioResponse: buildScenarioResponse(),
            sensitivityResponse: buildSensitivityResponse(),
            targetNodeDevelopmentPerDay: 0.68,
            setTargetNodeDevelopmentPerDay: vi.fn(),
            optimizationMode: 'balanced',
            setOptimizationMode: vi.fn(),
            customScenario: null,
            setCustomScenario,
            includeEnergyCost: true,
            setIncludeEnergyCost: vi.fn(),
            includeLaborCost: true,
            setIncludeLaborCost: vi.fn(),
            telemetryOptimizationBlocked: false,
            loading: false,
            loadingState: false,
            loadingOptimize: false,
            error: null,
            refreshState: vi.fn(),
            refreshOptimization: vi.fn(),
        });

        renderPanel();

        fireEvent.change(screen.getByLabelText('비교 이름'), { target: { value: '사용자 +0.4°C' } });
        fireEvent.change(screen.getByLabelText('주간 최소 온도 custom'), { target: { value: '20.4' } });
        fireEvent.change(screen.getByLabelText('야간 최소 온도 custom'), { target: { value: '18.8' } });
        fireEvent.change(screen.getByLabelText('환기 편차 custom'), { target: { value: '0.2' } });
        fireEvent.change(screen.getByLabelText('스크린 편차 custom'), { target: { value: '4.5' } });
        fireEvent.click(screen.getByRole('button', { name: '비교에 반영' }));

        expect(setCustomScenario).toHaveBeenCalledWith({
            label: '사용자 +0.4°C',
            day_min_temp_C: 20.4,
            night_min_temp_C: 18.8,
            vent_bias_C: 0.2,
            screen_bias_pct: 4.5,
        });
    });
});
