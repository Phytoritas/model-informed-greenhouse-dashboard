import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOverviewSignalTrends } from './useOverviewSignalTrends';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown): Response {
    return {
        ok: true,
        json: async () => payload,
    } as Response;
}

describe('useOverviewSignalTrends', () => {
    async function flushAsyncWork() {
        await act(async () => {
            await Promise.resolve();
        });
    }

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-12T09:00:00+09:00'));
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('waits for the polling interval before refetching after a successful response', async () => {
        const payload = {
            status: 'success',
            crop: 'cucumber',
            greenhouse_id: 'cucumber',
            window_hours: 72,
            irradiance: {
                source: { provider: 'Open-Meteo' },
                unit: 'W/m²',
                points: [
                    { time: '2026-04-09T08:00:00+09:00', shortwave_radiation_w_m2: 180.0 },
                ],
            },
            source_sink: {
                source: { provider: 'Model runtime snapshots' },
                unit: 'index',
                status: 'ready',
                points: [
                    { time: '2026-04-09T08:00:00+09:00', source_sink_balance: 0.31, source_capacity: 12.0, sink_demand: 8.4 },
                ],
            },
        };

        fetchMock.mockResolvedValue(jsonResponse(payload));

        const { result } = renderHook(() => useOverviewSignalTrends('Cucumber'));

        await flushAsyncWork();
        await flushAsyncWork();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result.current.signals?.source_sink.status).toBe('ready');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(9_000);
        });
        await flushAsyncWork();

        expect(fetchMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1_000);
        });
        await flushAsyncWork();
        await flushAsyncWork();

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('queues one follow-up refresh when the interval fires during an in-flight request', async () => {
        const firstPayload = {
            status: 'success',
            crop: 'cucumber',
            greenhouse_id: 'cucumber',
            window_hours: 72,
            irradiance: {
                source: { provider: 'Open-Meteo' },
                unit: 'W/m²',
                points: [
                    { time: '2026-04-09T08:00:00+09:00', shortwave_radiation_w_m2: 180.0 },
                ],
            },
            source_sink: {
                source: { provider: 'Model runtime snapshots' },
                unit: 'index',
                status: 'ready',
                points: [
                    { time: '2026-04-09T08:00:00+09:00', source_sink_balance: 0.31, source_capacity: 12.0, sink_demand: 8.4 },
                ],
            },
        };
        const secondPayload = {
            ...firstPayload,
            irradiance: {
                ...firstPayload.irradiance,
                points: [
                    { time: '2026-04-09T08:00:00+09:00', shortwave_radiation_w_m2: 220.0 },
                ],
            },
        };

        let resolveSlowFetch: ((response: Response) => void) | null = null;
        fetchMock
            .mockResolvedValueOnce(jsonResponse(firstPayload))
            .mockImplementationOnce(() => new Promise<Response>((resolve) => {
                resolveSlowFetch = resolve;
            }))
            .mockResolvedValueOnce(jsonResponse(secondPayload));

        const { result } = renderHook(() => useOverviewSignalTrends('Cucumber'));

        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.signals?.irradiance.points[0]?.shortwave_radiation_w_m2).toBe(180.0);
        expect(result.current.refreshedAt).toBeTypeOf('number');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000);
        });
        await flushAsyncWork();

        expect(fetchMock).toHaveBeenCalledTimes(2);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000);
        });
        await flushAsyncWork();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(resolveSlowFetch).not.toBeNull();

        await act(async () => {
            resolveSlowFetch?.(jsonResponse(secondPayload));
            await Promise.resolve();
        });
        await flushAsyncWork();
        await flushAsyncWork();

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(result.current.signals?.irradiance.points[0]?.shortwave_radiation_w_m2).toBe(220.0);
    });

    it('maps aborted requests to a user-facing delay message', async () => {
        fetchMock.mockRejectedValueOnce(new DOMException('signal is aborted without reason', 'AbortError'));

        const { result } = renderHook(() => useOverviewSignalTrends('Cucumber'));

        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.error).toBe('실제 신호 추세 응답이 지연되고 있습니다.');
    });

    it('ignores a stale response after the crop changed', async () => {
        const cucumberPayload = {
            status: 'success',
            crop: 'cucumber',
            greenhouse_id: 'cucumber',
            window_hours: 72,
            irradiance: {
                source: { provider: 'Open-Meteo' },
                unit: 'W/m²',
                points: [
                    { time: '2026-04-09T08:00:00+09:00', shortwave_radiation_w_m2: 180.0 },
                ],
            },
            source_sink: {
                source: { provider: 'Model runtime snapshots' },
                unit: 'index',
                status: 'ready',
                points: [
                    { time: '2026-04-09T08:00:00+09:00', source_sink_balance: 0.31, source_capacity: 12.0, sink_demand: 8.4 },
                ],
            },
        };
        const tomatoPayload = {
            ...cucumberPayload,
            crop: 'tomato',
            greenhouse_id: 'tomato',
            irradiance: {
                ...cucumberPayload.irradiance,
                points: [
                    { time: '2026-04-09T08:00:00+09:00', shortwave_radiation_w_m2: 320.0 },
                ],
            },
        };

        let resolveCucumberFetch: ((response: Response) => void) | null = null;
        fetchMock
            .mockImplementationOnce(() => new Promise<Response>((resolve) => {
                resolveCucumberFetch = resolve;
            }))
            .mockResolvedValueOnce(jsonResponse(tomatoPayload));

        const { result, rerender } = renderHook(
            ({ crop }: { crop: 'Cucumber' | 'Tomato' }) => useOverviewSignalTrends(crop),
            { initialProps: { crop: 'Cucumber' as 'Cucumber' | 'Tomato' } },
        );

        await flushAsyncWork();

        rerender({ crop: 'Tomato' });
        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.signals?.irradiance.points[0]?.shortwave_radiation_w_m2).toBe(320.0);

        await act(async () => {
            resolveCucumberFetch?.(jsonResponse(cucumberPayload));
            await Promise.resolve();
        });
        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.signals?.irradiance.points[0]?.shortwave_radiation_w_m2).toBe(320.0);
    });

    it('keeps the previous irradiance series when a refresh returns sparse irradiance points', async () => {
        const firstPayload = {
            status: 'success',
            crop: 'cucumber',
            greenhouse_id: 'cucumber',
            window_hours: 72,
            irradiance: {
                source: { provider: 'Open-Meteo' },
                unit: 'W/m²',
                points: [
                    { time: '2026-04-09T08:00:00+09:00', shortwave_radiation_w_m2: 180.0 },
                    { time: '2026-04-09T09:00:00+09:00', shortwave_radiation_w_m2: 220.0 },
                ],
            },
            source_sink: {
                source: { provider: 'Model runtime snapshots' },
                unit: 'index',
                status: 'ready',
                points: [
                    { time: '2026-04-09T08:00:00+09:00', source_sink_balance: 0.31, source_capacity: 12.0, sink_demand: 8.4 },
                ],
            },
        };
        const sparsePayload = {
            ...firstPayload,
            irradiance: {
                ...firstPayload.irradiance,
                points: [
                    { time: '2026-04-09T10:00:00+09:00', shortwave_radiation_w_m2: 140.0 },
                ],
            },
        };

        fetchMock
            .mockResolvedValueOnce(jsonResponse(firstPayload))
            .mockResolvedValueOnce(jsonResponse(sparsePayload));

        const { result } = renderHook(() => useOverviewSignalTrends('Cucumber'));

        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.signals?.irradiance.points).toHaveLength(2);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000);
        });
        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.signals?.irradiance.points).toHaveLength(2);
        expect(result.current.signals?.irradiance.points[1]?.shortwave_radiation_w_m2).toBe(220.0);
    });
});
