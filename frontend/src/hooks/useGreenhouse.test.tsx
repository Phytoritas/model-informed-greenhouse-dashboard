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

function findSocket(pathSegment: string): MockWebSocket | undefined {
    return MockWebSocket.instances.find((socket) => socket.url.includes(pathSegment));
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
        window.localStorage.clear();
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

        expect(MockWebSocket.instances).toHaveLength(2);
        expect(findSocket('/ws/sim/cucumber')).toBeDefined();
        expect(findSocket('/ws/forecast/cucumber')).toBeDefined();

        unmount();
    });

    it('uses the backend KRW/kWh default before settings finish loading', async () => {
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
                return new Promise<Response>(() => {});
            }
            if (url.includes('/forecast/')) {
                return Promise.resolve(jsonResponse({ daily: [] }));
            }
            return Promise.resolve(jsonResponse({}));
        });

        const { result, unmount } = renderHook(() => useGreenhouse());

        await waitFor(() => {
            expect(MockWebSocket.instances).toHaveLength(2);
        });

        await act(async () => {
            findSocket('/ws/sim/cucumber')?.onmessage?.({
                data: JSON.stringify({
                    t: '2026-04-26T00:00:00Z',
                    env: {
                        T_air_C: 23,
                        RH_percent: 70,
                        CO2_ppm: 550,
                        PAR_umol: 410,
                        VPD_kPa: 0.9,
                    },
                    state: { LAI: 2.1 },
                    energy: {
                        P_elec_kW: 2,
                        COP_current: 3.2,
                        Q_load_kW: 6.4,
                    },
                    kpi: {},
                }),
            } as MessageEvent<string>);
        });

        await waitFor(() => {
            expect(result.current.modelMetrics.energy.costPrediction).toBe(240);
        });

        unmount();
    });

    it('hydrates forecast snapshots from the backend forecast WebSocket while keeping REST fallback polling', async () => {
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
                return Promise.resolve(jsonResponse({
                    daily: [
                        {
                            date: '2026-04-26',
                            harvest_kg: 12.5,
                            ETc_mm: 4.2,
                        },
                    ],
                    total_harvest_kg: 12.5,
                    total_ETc_mm: 4.2,
                    total_energy_kWh: 18.4,
                }));
            }
            return Promise.resolve(jsonResponse({}));
        });

        const { result, unmount } = renderHook(() => useGreenhouse());

        await waitFor(() => {
            expect(findSocket('/ws/forecast/cucumber')).toBeDefined();
        });

        await act(async () => {
            findSocket('/ws/forecast/cucumber')?.onmessage?.({
                data: JSON.stringify({
                    type: 'forecast.snapshot',
                    daily: [
                        {
                            date: '2026-04-26',
                            harvest_kg: 12.5,
                            ETc_mm: 4.2,
                        },
                    ],
                    last: { datetime: '2026-04-26T23:00:00Z' },
                    total_harvest_kg: 12.5,
                    total_ETc_mm: 4.2,
                    total_energy_kWh: 18.4,
                }),
            } as MessageEvent<string>);
        });

        await waitFor(() => {
            expect(result.current.forecast?.total_harvest_kg).toBe(12.5);
            expect(result.current.forecast?.daily).toHaveLength(1);
        });

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/forecast/cucumber'));

        unmount();
    });

    it('does not auto-restart the simulation when the backend reports it paused (R13)', async () => {
        // Negative test for R13: while a crop is paused, the auto-recovery loop in
        // ensureSimulationRunning must never POST /start, so a user-initiated pause is
        // not silently overridden by the frontend recovery logic.
        fetchMock.mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/status')) {
                return Promise.resolve(jsonResponse({
                    greenhouses: {
                        cucumber: {
                            status: 'paused',
                            total_rows: 12,
                            idx: 3,
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

        // The module-level fetch spy accumulates calls across tests; clear it so the
        // negative /start assertion only sees calls made by this paused-crop scenario.
        fetchMock.mockClear();

        const { unmount } = renderHook(() => useGreenhouse());

        // Wait until the recovery loop has actually queried /status for the crop.
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('/status'),
                expect.anything(),
            );
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(fetchMock).not.toHaveBeenCalledWith(
            expect.stringContaining('/start'),
            expect.objectContaining({ method: 'POST' }),
        );

        unmount();
    });

    it('preserves chart history and crop selection when a pace change is reapplied on connect (R14)', async () => {
        // Negative test for R14: a pace change (persisted to sg-sim-pace and reapplied via
        // applyStoredSimulationPace on the telemetry socket open, per R11) must not reset the
        // accumulated chart history arrays or the current crop selection.
        window.localStorage.setItem('sg-sim-pace', '30');

        const { result, unmount } = renderHook(() => useGreenhouse());

        await waitFor(() => {
            expect(findSocket('/ws/sim/cucumber')).toBeDefined();
        });

        const simSocket = findSocket('/ws/sim/cucumber')!;

        // Accumulate one chart-history point from a telemetry frame.
        await act(async () => {
            simSocket.onmessage?.({
                data: JSON.stringify({
                    t: '2026-04-26T00:00:00Z',
                    env: {
                        T_air_C: 23,
                        RH_percent: 70,
                        CO2_ppm: 550,
                        PAR_umol: 410,
                        VPD_kPa: 0.9,
                    },
                    state: { LAI: 2.1 },
                    kpi: {},
                }),
            } as MessageEvent<string>);
        });

        await waitFor(() => {
            expect(result.current.history.length).toBeGreaterThan(0);
        });

        const historyLengthBeforePace = result.current.history.length;
        const cropBeforePace = result.current.selectedCrop;

        // User changes the pace: the panel persists the new preset, then a (re)connect
        // reapplies it against the backend via POST /speed.
        window.localStorage.setItem('sg-sim-pace', '6000');
        fetchMock.mockClear();
        await act(async () => {
            simSocket.readyState = MockWebSocket.OPEN;
            simSocket.onopen?.(new Event('open'));
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('/speed'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"sim_seconds_per_real_second":6000'),
                }),
            );
        });

        expect(result.current.history.length).toBe(historyLengthBeforePace);
        expect(result.current.selectedCrop).toBe(cropBeforePace);

        unmount();
    });

    it('applies the default 600 pace on a fresh connect when nothing is stored (R28)', async () => {
        // Negative test for R28: with an empty sg-sim-pace the readable default of 600
        // sim-seconds/real-second must actually be POSTed on the telemetry socket open.
        // Without this, the backend keeps its legacy step_sim_duration/0.1 fallback
        // (6000 for the default 10-min data) and the simulation runs away at ~100 sim
        // minutes per real second while the control still highlights 600.
        expect(window.localStorage.getItem('sg-sim-pace')).toBeNull();

        const { unmount } = renderHook(() => useGreenhouse());

        await waitFor(() => {
            expect(findSocket('/ws/sim/cucumber')).toBeDefined();
        });

        const simSocket = findSocket('/ws/sim/cucumber')!;

        fetchMock.mockClear();
        await act(async () => {
            simSocket.readyState = MockWebSocket.OPEN;
            simSocket.onopen?.(new Event('open'));
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('/speed'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"sim_seconds_per_real_second":600,'),
                }),
            );
        });

        // 600 is the default, not a persisted user choice, so storage stays empty and a
        // later change to the default constant would still take effect (R28 precedence).
        expect(window.localStorage.getItem('sg-sim-pace')).toBeNull();

        unmount();
    });
});
