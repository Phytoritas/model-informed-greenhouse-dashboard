import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatAssistant from './ChatAssistant';
import { LocaleProvider } from '../i18n/LocaleProvider';
import type { AdvancedModelMetrics, SensorData } from '../types';

const currentData: SensorData = {
    timestamp: 1_775_430_000_000,
    temperature: 25.8,
    canopyTemp: 26.7,
    humidity: 78,
    co2: 610,
    light: 340,
    soilMoisture: 54,
    vpd: 1.02,
    transpiration: 0.19,
    stomatalConductance: 0.24,
    photosynthesis: 12.8,
    hFlux: 42,
    leFlux: 95,
    energyUsage: 4.1,
};

const metrics: AdvancedModelMetrics = {
    cropType: 'Cucumber',
    growth: {
        lai: 3.1,
        biomass: 2950,
        developmentStage: 'fruiting',
        growthRate: 6.8,
    },
    yield: {
        predictedWeekly: 11.4,
        confidence: 0.82,
        harvestableFruits: 18,
    },
    energy: {
        consumption: 4.1,
        costPrediction: 920,
        efficiency: 0.76,
    },
};

describe('ChatAssistant', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders deterministic model-effect values from advisor chat responses', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({
                text: '## Summary\n- The model-calculated result is shown above.',
                machine_payload: {
                    display: null,
                    model_runtime: {
                        status: 'ready',
                        summary: 'Process-model scenario is ready.',
                        state_snapshot: {
                            lai: 3.1,
                            source_sink_balance: 0.14,
                            canopy_net_assimilation_umol_m2_s: 12.8,
                            limiting_factor: 'rubisco',
                        },
                        scenario: {
                            baseline_outputs: [],
                            options: [],
                            recommended: {
                                action: 'Day CO2 +100ppm',
                                control: 'co2_setpoint_day',
                                direction: 'increase',
                                delta: 100,
                                unit: 'ppm',
                                score: 0.42,
                                violated_constraints: [],
                            },
                        },
                        sensitivity: {
                            confidence: 0.86,
                            top_levers: [],
                        },
                        constraint_checks: {
                            status: 'pass',
                            violated_constraints: [],
                        },
                        recommendations: [],
                        answer_focus: {
                            matched_user_request: true,
                            step_label: '+100ppm',
                            action: 'Day CO2 +100ppm',
                            summary: 'Day CO2 +100ppm is calculated with yield and balance gains.',
                            confidence: 0.86,
                            effects: {
                                yield_delta_72h: 3.748547,
                                yield_delta_14d: 17.493218,
                                canopy_delta_72h: 0.94,
                                source_sink_balance_delta: 0.091622,
                                energy_delta: 0.24,
                            },
                        },
                    },
                },
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <LocaleProvider>
                <ChatAssistant
                    layoutMode="inline"
                    currentData={currentData}
                    metrics={metrics}
                    crop="Cucumber"
                />
            </LocaleProvider>,
        );

        fireEvent.change(
            screen.getByPlaceholderText('Example: What happens if I raise CO2 by 100 ppm now?'),
            { target: { value: 'What happens if I raise CO2 by 100 ppm now?' } },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('Model-calculated effect')).toBeTruthy();
        expect(screen.getByText(/14d \+17\.493/)).toBeTruthy();
        expect(screen.getByText(/S\/S \+0\.092/)).toBeTruthy();
        expect(screen.getByText(/Confidence 86%/)).toBeTruthy();
    });

    it('does not render fallback model-effect cards for generic chat responses', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({
                text: 'Hold current settings and keep monitoring.',
                machine_payload: {
                    display: null,
                    model_runtime: {
                        status: 'ready',
                        summary: 'Process-model scenario is ready.',
                        state_snapshot: {},
                        scenario: {
                            baseline_outputs: [],
                            options: [],
                            recommended: null,
                        },
                        sensitivity: {
                            confidence: 0.6,
                            top_levers: [],
                        },
                        constraint_checks: {
                            status: 'pass',
                            violated_constraints: [],
                        },
                        recommendations: [],
                        answer_focus: {
                            matched_user_request: false,
                            step_label: '+100ppm',
                            summary: 'Fallback recommendation, not a requested what-if.',
                            effects: {
                                yield_delta_14d: 17.493218,
                            },
                        },
                    },
                },
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <LocaleProvider>
                <ChatAssistant
                    layoutMode="inline"
                    currentData={currentData}
                    metrics={metrics}
                    crop="Cucumber"
                />
            </LocaleProvider>,
        );

        fireEvent.change(
            screen.getByPlaceholderText('Example: What happens if I raise CO2 by 100 ppm now?'),
            { target: { value: 'What should I watch today?' } },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(screen.queryByText('Model-calculated effect')).toBeNull();
        expect(screen.queryByText(/14d \+17\.493/)).toBeNull();
    });
});
