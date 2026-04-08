import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRtrProfiles } from './useRtrProfiles';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown): Response {
    return {
        ok: true,
        json: async () => payload,
    } as Response;
}

describe('useRtrProfiles', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('preserves the raw RTR profile payload so future contract fields are not dropped', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({
                status: 'ready',
                version: 2,
                updatedAt: '2026-04-08T00:00:00Z',
                mode: 'baseline',
                optimizerEnabled: true,
                availableModes: ['baseline', 'optimizer'],
                experimentalMeta: {
                    contract: 'keep-me',
                },
                profiles: {
                    Tomato: {
                        crop: 'Tomato',
                        strategyLabel: 'tomato',
                        sourceNote: 'demo',
                        lightToRadiantDivisor: 218,
                        baseTempC: 18.553,
                        slopeCPerMjM2: 0.7913,
                        toleranceC: 1,
                        calibration: {
                            mode: 'heuristic-fallback',
                            sampleDays: 14,
                            fitStartDate: null,
                            fitEndDate: null,
                            minCoverageHours: 12,
                            rSquared: null,
                            meanAbsoluteErrorC: null,
                        },
                        optimizer: {
                            enabled: true,
                            default_mode: 'balanced',
                            max_delta_temp_C: 1.5,
                            max_rtr_ratio_delta: 0.04,
                            temp_slew_rate_C_per_step: 0.12,
                            weights: {
                                temp: 1,
                                node: 130,
                                carbon: 110,
                                sink: 90,
                                resp: 25,
                                risk: 120,
                                energy: 25,
                                labor: 18,
                            },
                        },
                    },
                    Cucumber: {
                        crop: 'Cucumber',
                        strategyLabel: 'cucumber',
                        sourceNote: 'demo',
                        lightToRadiantDivisor: 218,
                        baseTempC: 18.132,
                        slopeCPerMjM2: 0.3099,
                        toleranceC: 1,
                        calibration: {
                            mode: 'heuristic-fallback',
                            sampleDays: 14,
                            fitStartDate: null,
                            fitEndDate: null,
                            minCoverageHours: 12,
                            rSquared: null,
                            meanAbsoluteErrorC: null,
                        },
                        optimizer: {
                            enabled: true,
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
                    },
                },
            }),
        );

        const { result } = renderHook(() => useRtrProfiles());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.profiles).not.toBeNull();
        });

        expect((result.current.profiles as { experimentalMeta?: { contract?: string } }).experimentalMeta?.contract).toBe('keep-me');
        expect(result.current.profiles?.profiles.Cucumber.optimizer?.default_mode).toBe('balanced');
    });
});
