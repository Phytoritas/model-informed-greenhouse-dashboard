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
            await vi.advanceTimersByTimeAsync(59_000);
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
});
