import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSmartGrowKnowledge } from './useSmartGrowKnowledge';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, ok = true): Response {
    return {
        ok,
        json: async () => payload,
    } as Response;
}

describe('useSmartGrowKnowledge', () => {
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

    it('keeps the error explicit and retries until knowledge status recovers', async () => {
        const recoveredPayload = {
            summary: {
                advisory_surface_names: ['pesticide'],
                pending_parsers: [],
            },
            advisory_surfaces: {
                pesticide: {
                    status: 'ready',
                    route: '/api/pesticides/recommend',
                    delegate_route: '/api/advisor/tab/pesticide',
                    request_contract: {
                        required: ['crop', 'disease'],
                        optional: ['weather'],
                    },
                },
            },
        };

        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(
                    {
                        detail: 'Knowledge status booting',
                    },
                    false,
                ),
            )
            .mockResolvedValueOnce(jsonResponse(recoveredPayload))
            .mockResolvedValue(jsonResponse(recoveredPayload));

        const { result } = renderHook(() => useSmartGrowKnowledge('Cucumber'));

        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Knowledge status booting');
        expect(result.current.summary).toBeNull();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        await flushAsyncWork();
        await flushAsyncWork();

        expect(result.current.error).toBeNull();
        expect(result.current.summary?.pesticideReady).toBe(true);
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});
