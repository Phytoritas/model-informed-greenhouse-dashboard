import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGreenhouse } from './useGreenhouse';

vi.mock('../context/AreaUnitContext', () => ({
    useAreaUnit: () => ({
        areaByCrop: {
            Tomato: { canonicalAreaM2: 3305.8 },
            Cucumber: { canonicalAreaM2: 3305.8 },
        },
    }),
}));

vi.mock('../i18n/LocaleProvider', () => ({
    useLocale: () => ({ locale: 'ko' }),
}));

class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    static instances: MockWebSocket[] = [];

    readonly url: string;
    readyState = MockWebSocket.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
    }
}

const fetchMock = vi.fn();

function jsonResponse(payload: unknown): Response {
    return {
        ok: true,
        json: async () => payload,
    } as Response;
}

describe('useGreenhouse', () => {
    beforeEach(() => {
        fetchMock.mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/status')) {
                return Promise.resolve(jsonResponse({
                    greenhouses: {
                        cucumber: {
                            status: 'idle',
                            total_rows: 12,
                            idx: 0,
                        },
                    },
                }));
            }
            if (url.includes('/start')) {
                return Promise.resolve(jsonResponse({ status: 'success' }));
            }
            if (url.includes('/settings?crop=')) {
                return Promise.resolve(jsonResponse({ cost_per_kwh: 0.15 }));
            }
            if (url.includes('/forecast/')) {
                return Promise.resolve(jsonResponse({ daily: [] }));
            }
            return Promise.resolve(jsonResponse({}));
        });

        MockWebSocket.instances = [];
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('does not force a reconnect while the initial socket is still connecting', async () => {
        const { unmount } = renderHook(() => useGreenhouse());

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('/start'),
                expect.objectContaining({ method: 'POST' }),
            );
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(MockWebSocket.instances).toHaveLength(1);

        unmount();
    });
});
