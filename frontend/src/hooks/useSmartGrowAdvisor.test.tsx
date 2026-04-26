import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSmartGrowAdvisor } from './useSmartGrowAdvisor';

const fetchMock = vi.fn();

function jsonTextResponse(payload: unknown): Response {
    return {
        ok: true,
        text: async () => JSON.stringify(payload),
    } as Response;
}

describe('useSmartGrowAdvisor', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('uses the canonical hyphenated harvest-market advisor tab endpoint', async () => {
        fetchMock.mockResolvedValue(jsonTextResponse({
            status: 'success',
            family: 'advisor_tab',
            crop: 'cucumber',
            tab_name: 'harvest_market',
            display: {
                summary: 'Harvest market ready',
                risks: [],
                actions_now: [],
                actions_today: [],
                actions_week: [],
                monitor: [],
                confidence: 0.7,
                sections: [],
            },
            machine_payload: {},
        }));

        const { result } = renderHook(() => useSmartGrowAdvisor('cucumber'));

        await act(async () => {
            await result.current.runPlannedTab('harvest_market', { producePrices: {} });
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url.endsWith('/api/advisor/tab/harvest-market')).toBe(true);
        expect(JSON.parse(request.body as string)).toEqual({
            crop: 'cucumber',
            dashboard: { producePrices: {} },
        });
    });
});
