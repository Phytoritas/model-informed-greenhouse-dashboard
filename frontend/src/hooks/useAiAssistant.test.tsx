import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdvancedModelMetrics, SensorData } from '../types';
import { useAiAssistant } from './useAiAssistant';

vi.mock('../i18n/LocaleProvider', () => ({
    useLocale: () => ({ locale: 'ko' }),
}));

vi.mock('../utils/aiDashboardContext', () => ({
    buildAiDashboardContext: () => ({}),
}));

const fetchMock = vi.fn();

function jsonResponse(payload: unknown): Response {
    return {
        ok: true,
        text: async () => JSON.stringify(payload),
    } as Response;
}

const sampleSensorData: SensorData = {
    timestamp: 1_000,
    receivedAtTimestamp: 1_000,
    temperature: 24,
    canopyTemp: 24,
    humidity: 70,
    co2: 900,
    light: 500,
    soilMoisture: 0.3,
    vpd: 1.2,
    transpiration: 2.5,
    stomatalConductance: 0.2,
    photosynthesis: 12,
    hFlux: 0,
    leFlux: 0,
    energyUsage: 10,
};

const sampleMetrics: AdvancedModelMetrics = {
    cropType: 'Cucumber',
    growth: {
        lai: 3.2,
        biomass: 5.4,
        developmentStage: 'vegetative',
        growthRate: 0.2,
    },
    yield: {
        predictedWeekly: 10,
        confidence: 0.7,
        harvestableFruits: 12,
    },
    energy: {
        consumption: 5,
        costPrediction: 2,
        efficiency: 0.9,
    },
};

describe('useAiAssistant', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    it('ignores a finished response after the active crop changed', async () => {
        let resolveFetch: ((response: Response) => void) | null = null;
        fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
            resolveFetch = resolve;
        }));

        const { result } = renderHook(() => useAiAssistant());

        act(() => {
            result.current.setActiveCrop('Cucumber');
        });

        let analyzeResult = false;
        await act(async () => {
            const analyzePromise = result.current.analyzeData(sampleSensorData, sampleMetrics, 'Cucumber');
            result.current.setActiveCrop('Tomato');
            resolveFetch?.(jsonResponse({
                text: 'cucumber summary',
                machine_payload: {
                    display: {
                        summary: '오이 요약',
                        actions_now: ['오이 조치'],
                        actions_today: [],
                        actions_week: [],
                        monitor: [],
                    },
                    model_runtime: {
                        summary: '오이 런타임',
                        scenario: {
                            recommended: { action: '오이 전략' },
                        },
                    },
                },
            }));
            analyzeResult = await analyzePromise;
        });

        expect(analyzeResult).toBe(false);
        expect(result.current.aiDisplay).toBeNull();
        expect(result.current.aiModelRuntime).toBeNull();
        expect(result.current.advisorUpdatedAt).toBeNull();
    });
});
