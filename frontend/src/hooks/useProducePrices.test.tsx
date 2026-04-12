import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProducePrices } from './useProducePrices';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown): Response {
    return {
        ok: true,
        json: async () => payload,
    } as Response;
}

describe('useProducePrices', () => {
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

    it('retries quickly until produce prices recover after an initial timeout', async () => {
        const recoveredPayload = {
            source: {
                provider: 'KAMIS',
            },
            summary: 'Recovered market snapshot',
            items: [],
            markets: {
                retail: {
                    market_key: 'retail',
                    market_label: 'Retail',
                    summary: 'Recovered retail snapshot',
                    items: [],
                },
                wholesale: {
                    market_key: 'wholesale',
                    market_label: 'Wholesale',
                    summary: 'Recovered wholesale snapshot',
                    items: [],
                },
            },
            trend: {
                market_key: 'retail',
                series: [],
                unavailable_series: [],
            },
        };

        fetchMock
            .mockRejectedValueOnce(new DOMException('timed out', 'AbortError'))
            .mockResolvedValueOnce(jsonResponse(recoveredPayload))
            .mockResolvedValue(jsonResponse(recoveredPayload));

        const { result } = renderHook(() => useProducePrices());

        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Produce price request timed out.');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.error).toBeNull();
        expect(result.current.prices?.summary).toBe('Recovered market snapshot');
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('keeps loading false during recovery retries after the initial request settles', async () => {
        const payload = {
            source: {
                provider: 'KAMIS',
            },
            summary: 'Recovered market snapshot',
            items: [],
            markets: {
                retail: {
                    market_key: 'retail',
                    market_label: 'Retail',
                    summary: 'Recovered retail snapshot',
                    items: [],
                },
                wholesale: {
                    market_key: 'wholesale',
                    market_label: 'Wholesale',
                    summary: 'Recovered wholesale snapshot',
                    items: [],
                },
            },
            trend: {
                market_key: 'retail',
                series: [],
                unavailable_series: [],
            },
        };

        let resolveRetry: ((response: Response) => void) | null = null;
        fetchMock
            .mockRejectedValueOnce(new DOMException('timed out', 'AbortError'))
            .mockImplementationOnce(() => new Promise<Response>((resolve) => {
                resolveRetry = resolve;
            }))
            .mockResolvedValue(jsonResponse(payload));

        const { result } = renderHook(() => useProducePrices());

        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.loading).toBe(false);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        await flushAsyncWork();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.current.loading).toBe(false);
        expect(resolveRetry).not.toBeNull();

        await act(async () => {
            resolveRetry?.(jsonResponse(payload));
            await Promise.resolve();
        });
        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });
});
