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
            screen.getByPlaceholderText('예: 지금 이산화탄소를 100ppm 더 올리면 어떻게 되나요?'),
            { target: { value: 'What happens if I raise CO2 by 100 ppm now?' } },
        );
        fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('모델 계산 효과')).toBeTruthy();
        expect(screen.getByText(/14일 \+17\.493/)).toBeTruthy();
        expect(screen.getByText(/균형 \+0\.092/)).toBeTruthy();
        expect(screen.getByText(/계산 신뢰도 86%/)).toBeTruthy();
        expect(screen.queryByText(/추천:/)).toBeNull();
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
            screen.getByPlaceholderText('예: 지금 이산화탄소를 100ppm 더 올리면 어떻게 되나요?'),
            { target: { value: 'What should I watch today?' } },
        );
        fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(screen.queryByText('모델 계산 효과')).toBeNull();
        expect(screen.queryByText(/14일 \+17\.493/)).toBeNull();
    });

    it('renders current-state chat responses without unrelated recommendations or duplicate action blocks', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({
                text: '## 핵심 요약\n- 현재 생육은 잎면적과 군락 동화량을 기준으로 확인했습니다.\n\n## 작업 순서\n- 별도 조정 질문이 있을 때만 계산합니다.',
                machine_payload: {
                    display: {
                        language: 'ko',
                        summary: '현재 생육은 잎면적 0.21, 공급/수요 균형 -0.52, 군락 동화량 0.1 µmol 기준으로 봅니다.',
                        risks: [],
                        actions_now: [],
                        actions_today: [],
                        actions_week: [],
                        monitor: ['다음 관측 때 마디수와 잎면적을 같은 시간대에 기록하세요.'],
                        confidence: 0.82,
                    },
                    model_runtime: {
                        status: 'ready',
                        runtime_mode: 'current_state',
                        summary: '현재 생육 상태를 진단합니다. 제어 변경 효과는 사용자가 조정 범위를 물을 때만 계산합니다.',
                        state_snapshot: {
                            lai: 0.21,
                            source_sink_balance: -0.52,
                            canopy_net_assimilation_umol_m2_s: 0.1,
                            limiting_factor: 'electron_transport',
                            node_count: 5,
                        },
                        scenario: {
                            baseline_outputs: [],
                            options: [],
                            recommended: null,
                            confidence: 0.82,
                        },
                        sensitivity: {
                            confidence: 0.82,
                            top_levers: [],
                        },
                        constraint_checks: {
                            status: 'monitoring-first',
                            violated_constraints: [],
                        },
                        recommendations: [],
                        answer_focus: null,
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
            screen.getByPlaceholderText('예: 지금 이산화탄소를 100ppm 더 올리면 어떻게 되나요?'),
            { target: { value: '지금 생육 상태 알려줘' } },
        );
        fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(await screen.findByText(/현재 생육은 잎면적 0\.21/)).toBeTruthy();
        expect(screen.getByText('생육 상태 스냅샷')).toBeTruthy();
        expect(screen.getByText(/광 반응/)).toBeTruthy();
        expect(screen.queryByText('모델 계산 효과')).toBeNull();
        expect(screen.queryByText(/추천:/)).toBeNull();
        expect(screen.queryByText('농가용 요약')).toBeNull();
    });
});
