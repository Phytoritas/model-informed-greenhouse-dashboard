import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    RtrOptimizeResponse,
    RtrScenarioResponse,
    RtrSensitivityResponse,
    RtrStateResponse,
} from '../types';
import { useRtrOptimizer } from './useRtrOptimizer';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown): Response {
    return {
        ok: true,
        json: async () => payload,
    } as Response;
}

function deferredResponse<T>() {
    let resolve!: (value: Response) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<Response>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {
        promise,
        resolve: (payload: T) => resolve(jsonResponse(payload)),
        reject,
    };
}

function buildStateResponse(): RtrStateResponse {
    return {
        status: 'ready',
        crop: 'cucumber',
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
            crop: 'cucumber',
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
                predicted_node_rate_day: 0.73,
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
                recent_leaf_removal: [],
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
        crop: 'cucumber',
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
            recent_leaf_removal_count: 0,
        },
        warning_badges: [],
        units_m2: {
            greenhouse_area_m2: 3305.8,
            actual_area_m2: 2809.92,
            actual_area_pyeong: 850,
            yield_proxy_kg_m2_day: 0.043,
            yield_proxy_kg_m2_week: 0.301,
            energy_kwh_m2_day: 2.9,
            energy_krw_m2_day: 348,
            labor_index_m2_day: 0.57,
            node_development_day: 0.73,
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
            summary: 'summary',
            target_node_development_per_day: 0.73,
            baseline_mean_temp_C: 19.1,
            optimized_mean_temp_C: 19.5,
            reason_tags: ['temperature-up'],
            crop_summary: 'crop summary',
            missing_work_event_warning: null,
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
            method: 'two-stage-l-bfgs-b',
            stage1_success: true,
            stage2_success: true,
            stage1_message: 'ok',
            stage2_message: 'ok',
        },
    };
}

function buildScenarioResponse(): RtrScenarioResponse {
    return {
        status: 'ready',
        crop: 'cucumber',
        greenhouse_id: 'house-a',
        snapshot_id: 'snap-001',
        target_node_development_per_day: 0.73,
        area_unit_meta: {
            greenhouse_area_m2: 3305.8,
            actual_area_m2: 2809.92,
            actual_area_pyeong: 850,
        },
        scenarios: [
            {
                label: 'balanced',
                mode: 'optimizer',
                mean_temp_C: 19.5,
                day_min_temp_C: 20,
                night_min_temp_C: 18.4,
                node_rate_day: 0.73,
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
                objective_breakdown: buildOptimizeResponse().objective_breakdown,
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
        crop: 'cucumber',
        greenhouse_id: 'house-a',
        snapshot_id: 'snap-001',
        target_horizon: 'today',
        step_c: 0.3,
        optimized_targets: buildOptimizeResponse().optimal_targets,
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
        ],
    };
}

describe('useRtrOptimizer', () => {
    beforeEach(() => {
        window.localStorage.clear();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        fetchMock.mockImplementation((input: string | URL) => {
            const url = String(input);
            if (url.includes('/rtr/state')) return Promise.resolve(jsonResponse(buildStateResponse()));
            if (url.includes('/rtr/optimize')) return Promise.resolve(jsonResponse(buildOptimizeResponse()));
            if (url.includes('/rtr/scenario')) return Promise.resolve(jsonResponse(buildScenarioResponse()));
            if (url.includes('/rtr/sensitivity')) return Promise.resolve(jsonResponse(buildSensitivityResponse()));
            if (url.includes('/rtr/area-settings')) return Promise.resolve(jsonResponse({ status: 'ok' }));
            return Promise.reject(new Error(`Unexpected URL: ${url}`));
        });
    });

    afterEach(() => {
        window.localStorage.clear();
        vi.unstubAllGlobals();
    });

    it('hydrates target node rate from RTR state before sending optimizer requests', async () => {
        const { result } = renderHook(() =>
            useRtrOptimizer({
                crop: 'Cucumber',
                actualAreaM2: 2809.92,
                actualAreaPyeong: 850,
                actualAreaSource: 'server',
                optimizerEnabled: true,
                defaultMode: 'energy_saving',
            }),
        );

        await waitFor(() => {
            expect(result.current.stateResponse?.canonical_state.growth.predicted_node_rate_day).toBe(0.73);
            expect(result.current.optimizeResponse).not.toBeNull();
        });

        expect(result.current.stateResponse?.crop).toBe('cucumber');

        const stateCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/rtr/state'));
        expect(stateCall?.[0]).toEqual(expect.stringContaining('/rtr/state?crop=cucumber'));

        expect(result.current.targetNodeDevelopmentPerDay).toBe(0.73);

        const optimizeCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/rtr/optimize'));
        expect(optimizeCall).toBeTruthy();
        const optimizeBody = JSON.parse(String((optimizeCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
        expect(optimizeBody.crop).toBe('cucumber');
        expect(optimizeBody.snapshot_id).toBe('snap-001');
        expect(optimizeBody.target_node_development_per_day).toBe(0.73);
        expect(optimizeBody.optimization_mode).toBe('energy_saving');
    });

    it('sends a grower-entered hourly labor rate as the RTR labor-cost override', async () => {
        const { result } = renderHook(() =>
            useRtrOptimizer({
                crop: 'Cucumber',
                actualAreaM2: 2809.92,
                actualAreaPyeong: 850,
                actualAreaSource: 'server',
                optimizerEnabled: true,
                autoRunSupplemental: false,
            }),
        );

        await waitFor(() => {
            expect(result.current.optimizeResponse).not.toBeNull();
        });
        const initialOptimizeCount = fetchMock.mock.calls.filter(([url]) => String(url).includes('/rtr/optimize')).length;

        act(() => {
            result.current.setLaborRateKrwHour(21000);
        });

        await waitFor(() => {
            const optimizeCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/rtr/optimize'));
            expect(optimizeCalls.length).toBeGreaterThan(initialOptimizeCount);
            const latestCall = optimizeCalls[optimizeCalls.length - 1];
            const latestBody = JSON.parse(String((latestCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
            expect(latestBody.user_labor_cost_coefficient).toBe(21000);
        });
    });

    it('stays idle when the optimizer surface is inactive', async () => {
        const { result } = renderHook(() =>
            useRtrOptimizer({
                crop: 'Cucumber',
                actualAreaM2: 2809.92,
                actualAreaPyeong: 850,
                actualAreaSource: 'server',
                optimizerEnabled: true,
                active: false,
            }),
        );

        await waitFor(() => {
            expect(result.current.loadingState).toBe(false);
        });

        expect(result.current.stateResponse).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('hydrates optimize results before slower scenario and sensitivity responses finish', async () => {
        const optimizeDeferred = deferredResponse<RtrOptimizeResponse>();
        const scenarioDeferred = deferredResponse<RtrScenarioResponse>();
        const sensitivityDeferred = deferredResponse<RtrSensitivityResponse>();

        fetchMock.mockImplementation((input: string | URL) => {
            const url = String(input);
            if (url.includes('/rtr/state')) return Promise.resolve(jsonResponse(buildStateResponse()));
            if (url.includes('/rtr/optimize')) return optimizeDeferred.promise;
            if (url.includes('/rtr/scenario')) return scenarioDeferred.promise;
            if (url.includes('/rtr/sensitivity')) return sensitivityDeferred.promise;
            if (url.includes('/rtr/area-settings')) return Promise.resolve(jsonResponse({ status: 'ok' }));
            return Promise.reject(new Error(`Unexpected URL: ${url}`));
        });

        const { result } = renderHook(() =>
            useRtrOptimizer({
                crop: 'Cucumber',
                actualAreaM2: 2809.92,
                actualAreaPyeong: 850,
                actualAreaSource: 'server',
                optimizerEnabled: true,
            }),
        );

        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/optimize'))).toBe(true);
        });

        act(() => {
            optimizeDeferred.resolve(buildOptimizeResponse());
        });

        await waitFor(() => {
            expect(result.current.optimizeResponse?.optimal_targets.mean_temp_C).toBe(19.5);
        });

        expect(result.current.scenarioResponse).toBeNull();
        expect(result.current.sensitivityResponse).toBeNull();

        act(() => {
            scenarioDeferred.resolve(buildScenarioResponse());
            sensitivityDeferred.resolve(buildSensitivityResponse());
        });

        await waitFor(() => {
            expect(result.current.scenarioResponse?.scenarios[0]?.mean_temp_C).toBe(19.5);
            expect(result.current.sensitivityResponse?.sensitivities[0]?.control).toBe('temperature_day');
        });
    });

    it('keeps automatic recompute on the optimize endpoint unless supplemental refresh is requested', async () => {
        const { result } = renderHook(() =>
            useRtrOptimizer({
                crop: 'Cucumber',
                actualAreaM2: 2809.92,
                actualAreaPyeong: 850,
                actualAreaSource: 'server',
                optimizerEnabled: true,
                autoRunSupplemental: false,
            }),
        );

        await waitFor(() => {
            expect(result.current.optimizeResponse).not.toBeNull();
        });

        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/optimize'))).toBe(true);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/scenario'))).toBe(false);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/sensitivity'))).toBe(false);

        fetchMock.mockClear();

        await act(async () => {
            await result.current.refreshOptimization();
        });

        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/optimize'))).toBe(true);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/scenario'))).toBe(true);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/sensitivity'))).toBe(true);
    });

    it('does not persist server-hydrated area settings until the user makes a local override', async () => {
        const initialProps: {
            actualAreaM2: number | null;
            actualAreaPyeong: number | null;
            actualAreaSource: 'default' | 'server' | 'local';
        } = {
            actualAreaM2: 2809.92,
            actualAreaPyeong: 850,
            actualAreaSource: 'server',
        };

        const { result, rerender } = renderHook(
            (props: {
                actualAreaM2: number | null;
                actualAreaPyeong: number | null;
                actualAreaSource: 'default' | 'server' | 'local';
            }) =>
                useRtrOptimizer({
                    crop: 'Cucumber',
                    actualAreaM2: props.actualAreaM2,
                    actualAreaPyeong: props.actualAreaPyeong,
                    actualAreaSource: props.actualAreaSource,
                    optimizerEnabled: true,
                }),
            {
                initialProps,
            },
        );

        await waitFor(() => {
            expect(result.current.stateResponse).not.toBeNull();
        });

        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/area-settings'))).toBe(false);
        });

        rerender({
            actualAreaM2: 2975.21,
            actualAreaPyeong: 900,
            actualAreaSource: 'local',
        });

        await waitFor(() => {
            const areaSettingsCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/rtr/area-settings'));
            expect(areaSettingsCall).toBeTruthy();
            const body = JSON.parse(String((areaSettingsCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
            expect(body.crop).toBe('cucumber');
            expect(body.user_actual_area_pyeong).toBe(900);
            expect(body.user_actual_area_m2).toBe(2975.21);
        });
    });

    it('waits for a hydrated or manually entered target node rate before requesting optimizer surfaces', async () => {
        fetchMock.mockImplementation((input: string | URL) => {
            const url = String(input);
            if (url.includes('/rtr/state')) {
                const payload = buildStateResponse();
                (payload.canonical_state.growth as { predicted_node_rate_day?: number | null }).predicted_node_rate_day = null;
                return Promise.resolve(jsonResponse(payload));
            }
            if (url.includes('/rtr/optimize')) return Promise.resolve(jsonResponse(buildOptimizeResponse()));
            if (url.includes('/rtr/scenario')) return Promise.resolve(jsonResponse(buildScenarioResponse()));
            if (url.includes('/rtr/sensitivity')) return Promise.resolve(jsonResponse(buildSensitivityResponse()));
            if (url.includes('/rtr/area-settings')) return Promise.resolve(jsonResponse({ status: 'ok' }));
            return Promise.reject(new Error(`Unexpected URL: ${url}`));
        });

        const { result } = renderHook(() =>
            useRtrOptimizer({
                crop: 'Cucumber',
                actualAreaM2: 2809.92,
                actualAreaPyeong: 850,
                actualAreaSource: 'server',
                optimizerEnabled: true,
            }),
        );

        await waitFor(() => {
            expect(result.current.stateResponse).not.toBeNull();
            expect(result.current.loadingState).toBe(false);
        });

        expect(result.current.targetNodeDevelopmentPerDay).toBeNull();
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/optimize'))).toBe(false);

        result.current.setTargetNodeDevelopmentPerDay(0.68);

        await waitFor(() => {
            expect(result.current.optimizeResponse).not.toBeNull();
        });

        const optimizeCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/rtr/optimize'));
        const optimizeBody = JSON.parse(String((optimizeCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
        expect(optimizeBody.target_node_development_per_day).toBe(0.68);
    });

    it('does not immediately re-persist a local override restored from localStorage', async () => {
        const { result, rerender } = renderHook(
            (props: {
                actualAreaM2: number | null;
                actualAreaPyeong: number | null;
                actualAreaSource: 'default' | 'server' | 'local';
            }) =>
                useRtrOptimizer({
                    crop: 'Cucumber',
                    actualAreaM2: props.actualAreaM2,
                    actualAreaPyeong: props.actualAreaPyeong,
                    actualAreaSource: props.actualAreaSource,
                    optimizerEnabled: true,
                }),
            {
                initialProps: {
                    actualAreaM2: 2975.21,
                    actualAreaPyeong: 900,
                    actualAreaSource: 'local' as const,
                },
            },
        );

        await waitFor(() => {
            expect(result.current.stateResponse).not.toBeNull();
            expect(result.current.loadingState).toBe(false);
        });

        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/area-settings'))).toBe(false);

        rerender({
            actualAreaM2: 3018.52,
            actualAreaPyeong: 913.1,
            actualAreaSource: 'local' as const,
        });

        await waitFor(() => {
            const areaSettingsCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/rtr/area-settings'));
            expect(areaSettingsCall).toBeTruthy();
            const body = JSON.parse(String((areaSettingsCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
            expect(body.crop).toBe('cucumber');
            expect(body.user_actual_area_pyeong).toBe(913.1);
            expect(body.user_actual_area_m2).toBe(3018.52);
        });
    });

    it('restores persisted RTR manual settings from localStorage on first mount', async () => {
        window.localStorage.setItem('smartgrow-rtr-optimizer-state-v1', JSON.stringify({
            Cucumber: {
                targetNodeDevelopmentPerDay: 0.68,
                optimizationMode: 'yield_priority',
                customScenario: {
                    label: 'saved custom',
                    day_heating_min_temp_C: 20.1,
                    vent_bias_C: 0.2,
                },
                includeEnergyCost: false,
                includeCoolingCost: true,
                includeLaborCost: false,
                hasManualTarget: true,
                hasManualMode: true,
            },
        }));

        const { result } = renderHook(() =>
            useRtrOptimizer({
                crop: 'Cucumber',
                actualAreaM2: 2809.92,
                actualAreaPyeong: 850,
                actualAreaSource: 'server',
                optimizerEnabled: true,
                defaultMode: 'balanced',
            }),
        );

        await waitFor(() => {
            expect(result.current.optimizeResponse).not.toBeNull();
        });

        expect(result.current.targetNodeDevelopmentPerDay).toBe(0.68);
        expect(result.current.optimizationMode).toBe('yield_priority');
        expect(result.current.customScenario).toEqual({
            label: 'saved custom',
            day_heating_min_temp_C: 20.1,
            vent_bias_C: 0.2,
        });
        expect(result.current.includeEnergyCost).toBe(false);
        expect(result.current.includeLaborCost).toBe(false);

        const optimizeCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/rtr/optimize'));
        const optimizeBody = JSON.parse(String((optimizeCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
        expect(optimizeBody.target_node_development_per_day).toBe(0.68);
        expect(optimizeBody.optimization_mode).toBe('yield_priority');
        expect(optimizeBody.include_energy_cost).toBe(false);
        expect(optimizeBody.include_labor_cost).toBe(false);
    });

    it('blocks optimizer requests when telemetry is stale', async () => {
        const { result } = renderHook(() =>
            useRtrOptimizer({
                crop: 'Cucumber',
                actualAreaM2: 2809.92,
                actualAreaPyeong: 850,
                actualAreaSource: 'server',
                optimizerEnabled: true,
                telemetryStatus: 'stale',
            }),
        );

        await waitFor(() => {
            expect(result.current.stateResponse).not.toBeNull();
            expect(result.current.loadingState).toBe(false);
        });

        expect(result.current.telemetryOptimizationBlocked).toBe(true);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/optimize'))).toBe(false);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/scenario'))).toBe(false);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/sensitivity'))).toBe(false);
    });

    it('sends custom scenario payload only to the scenario endpoint', async () => {
        const { result } = renderHook(() =>
            useRtrOptimizer({
                crop: 'Cucumber',
                actualAreaM2: 2809.92,
                actualAreaPyeong: 850,
                actualAreaSource: 'server',
                optimizerEnabled: true,
            }),
        );

        await waitFor(() => {
            expect(result.current.optimizeResponse).not.toBeNull();
        });

        fetchMock.mockClear();

        act(() => {
            result.current.setCustomScenario({
                label: '사용자 +0.5°C',
                day_heating_min_temp_C: 20.5,
                night_heating_min_temp_C: 18.9,
                vent_bias_C: 0.2,
                screen_bias_pct: 4.0,
            });
        });

        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rtr/scenario'))).toBe(true);
        });

        const optimizeCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/rtr/optimize'));
        const scenarioCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/rtr/scenario'));
        const sensitivityCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/rtr/sensitivity'));

        expect(optimizeCall).toBeTruthy();
        expect(sensitivityCall).toBeTruthy();
        expect(scenarioCall).toBeTruthy();

        const optimizeBody = JSON.parse(String((optimizeCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
        const scenarioBody = JSON.parse(String((scenarioCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
        const sensitivityBody = JSON.parse(String((sensitivityCall?.[1] as RequestInit | undefined)?.body ?? '{}'));

        expect(optimizeBody.custom_scenario).toBeUndefined();
        expect(sensitivityBody.custom_scenario).toBeUndefined();
        expect(scenarioBody.custom_scenario).toEqual({
            label: '사용자 +0.5°C',
            day_heating_min_temp_C: 20.5,
            night_heating_min_temp_C: 18.9,
            vent_bias_C: 0.2,
            screen_bias_pct: 4.0,
        });
    });
});
