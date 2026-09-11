import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useOverviewSignalTrends } from './useOverviewSignalTrends';
import { useGreenhouse } from './useGreenhouse';
import { useSimulationRuntimeControls } from './useSimulationRuntimeControls';

vi.mock('../context/AreaUnitContext', () => ({
  useAreaUnit: () => ({ areaByCrop: {
    Tomato: { canonicalAreaM2: 3305.8 }, Cucumber: { canonicalAreaM2: 3305.8 },
  } }),
}));
vi.mock('../i18n/LocaleProvider', () => ({ useLocale: () => ({ locale: 'ko' }) }));

class Socket {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  static all: Socket[] = [];
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly url: string;
  constructor(url: string) { this.url = url; Socket.all.push(this); }
  close() { this.readyState = 3; }
}
const json = (payload: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => payload }) as Response;
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-08T09:00:00+09:00'));
  Socket.all = [];
  vi.stubGlobal('WebSocket', Socket);
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
    clear: () => items.clear(),
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('never presents prior-crop history during a switch or under a sparse new response', async () => {
  const cucumber = {
    status: 'success', crop: 'cucumber', greenhouse_id: 'cucumber', window_hours: 72,
    irradiance: { source: { provider: 'cucumber-source' }, unit: 'W/m²', points: [
      { time: '2026-09-08T08:00:00+09:00', shortwave_radiation_w_m2: 111 },
      { time: '2026-09-08T09:00:00+09:00', shortwave_radiation_w_m2: 222 },
    ] },
    source_sink: { source: { provider: 'Model runtime snapshots' }, unit: 'index', status: 'ready', points: [] },
  };
  let resolveTomato!: (value: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(json(cucumber))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveTomato = resolve; }));
  vi.stubGlobal('fetch', fetcher);
  const { result, rerender } = renderHook(({ crop }: { crop: 'Cucumber' | 'Tomato' }) => useOverviewSignalTrends(crop),
    { initialProps: { crop: 'Cucumber' as 'Cucumber' | 'Tomato' } });
  await flush(); await flush();
  rerender({ crop: 'Tomato' });
  await flush();
  expect(result.current.loading).toBe(true);
  expect(result.current.signals).toBeNull();
  await act(async () => { resolveTomato(json({ ...cucumber, crop: 'tomato', greenhouse_id: 'tomato',
    irradiance: { ...cucumber.irradiance, source: { provider: 'tomato-source' }, points: [] } })); });
  await flush();
  expect(result.current.signals?.crop).toBe('tomato');
  expect(result.current.signals?.irradiance.points).toEqual([]);
});

it('preserves an explicit stop and reports failed settings without changing accepted values', async () => {
  let backendStatus = 'active';
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/status')) return json({greenhouses: {cucumber: {
      status: backendStatus, total_rows: 100, idx: 10, task_alive: backendStatus === 'active', csv_filename: 'uploaded.csv',
    }}});
    if (url.includes('/stop?')) { backendStatus = 'stopped'; return json({ status: 'stopped', crops: ['cucumber'] }); }
    if (url.endsWith('/start')) { backendStatus = 'active'; return json({status: 'success'}); }
    if (url.includes('/config/ops?')) return json({detail: 'unavailable'}, false);
    if (url.includes('/forecast/')) return json({daily: []});
    return json({});
  });
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => ({greenhouse: useGreenhouse(), runtime: useSimulationRuntimeControls('Cucumber')}));
  await flush(); await flush();
  const socket = Socket.all.find(s => s.url.includes('/ws/sim/cucumber'))!;
  await act(async () => {
    socket.readyState = Socket.OPEN;
    socket.onopen?.(new Event('open'));
    socket.onmessage?.(new MessageEvent('message', {data: JSON.stringify({
      t: '2026-09-08T09:00:00+09:00', env: {T_air_C: 23, RH_percent: 65, CO2_ppm: 600, PAR_umol: 300, VPD_kPa: 1.0},
      state: {LAI: 2}, kpi: {stomatal_conductance: 0.2}, energy: {P_elec_kW: 1},
    })}));
  });
  await act(async () => { await result.current.runtime.stop(); });
  expect(backendStatus).toBe('stopped');
  await act(async () => { await vi.advanceTimersByTimeAsync(34_000); });
  const startCall = fetcher.mock.calls.find(([url]) => String(url).endsWith('/start'));
  expect(startCall).toBeUndefined();
  expect(result.current.runtime.status?.status).toBe('stopped');
  expect(result.current.runtime.status?.dataSource).toBe('uploaded.csv');
  await act(async () => {
    await expect(result.current.greenhouse.setTempSettings({heating: 21, cooling: 27, pBand: 4, co2Target: 800, drainTarget: 0.3})).rejects.toThrow();
  });
  expect(result.current.greenhouse.controls.settings.heating).toBe(18);
});

it('keeps simulated zero values distinct from invalid inputs and a missing soil sensor', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json({greenhouses: {cucumber: {status: 'paused'}}})));
  const { result } = renderHook(() => useGreenhouse());
  await flush();
  const socket = Socket.all.find(s => s.url.includes('/ws/sim/cucumber'))!;
  const payload = {t: '2026-09-08T09:00:00+09:00', env: {T_air_C: 23, RH_percent: 100, PAR_umol: 0, VPD_kPa: 0},
    state: {LAI: 2, simulation_status: 'ok'}, kpi: {stomatal_conductance: 0}};
  await act(async () => { socket.onmessage?.(new MessageEvent('message', {data: JSON.stringify(payload)})); });
  expect(result.current.currentData.vpd).toBe(0);
  expect(result.current.sensorFieldAvailability.vpd).toBe(true);
  expect(result.current.sensorFieldAvailability.soilMoisture).toBe(false);
  expect(result.current.metricHistory[0].timestamp).toBe(result.current.history[0].timestamp);
  expect(result.current.metricHistory[0].metrics?.growth.lai).toBe(2);
  await act(async () => {
    socket.onmessage?.(new MessageEvent('message', {data: JSON.stringify({...payload,
      t: '2026-09-08T09:10:00+09:00', data_quality: {status: 'invalid', source: 'csv_replay', issues: [{field: 'RH_percent', reason: 'missing'}]},
      state: {LAI: 0, simulation_status: 'invalid_input'},
    })}));
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(result.current.sensorFieldAvailability.humidity).toBe(false);
  expect(result.current.sensorFieldAvailability.stomatalConductance).toBe(false);
  expect(result.current.currentData.dataQuality?.status).toBe('invalid');
  expect(result.current.metricHistory[0].metrics?.growth.lai).toBe(2);
});
