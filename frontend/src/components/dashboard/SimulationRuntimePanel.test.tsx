import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SimulationRuntimePanel from './SimulationRuntimePanel';

const fetchMock = vi.fn();

function renderPanel() {
  return render(
    <SimulationRuntimePanel
      locale="en"
      crop="Cucumber"
      telemetryStatus="live"
    />,
  );
}

function mockSpeedResponse(ok: boolean) {
  let pace = Number(window.localStorage.getItem('sg-sim-pace') ?? 600);
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/status')) {
      return {
        ok: true,
        json: async () => ({ greenhouses: { cucumber: {
          status: 'active', running: true, paused: false,
          simulated_at: '2026-04-09T09:00:00Z', csv_filename: 'Cucumber_Env.CSV',
          idx: 14, progress: 0.25, sim_seconds_per_real_second: pace,
        } } }),
      };
    }
    if (url.includes('/datasets')) {
      return { ok: true, json: async () => ({ datasets: [], required_columns: [] }) };
    }
    if (!url.includes('/speed')) throw new Error(`Unexpected request: ${url}`);
    if (ok) pace = JSON.parse(String(init?.body)).sim_seconds_per_real_second;
    return {
      ok,
      status: ok ? 200 : 422,
      statusText: ok ? 'OK' : 'Unprocessable Entity',
      json: async () => (ok ? { status: 'success' } : { detail: 'invalid pace' }),
    };
  });
}

describe('SimulationRuntimePanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    mockSpeedResponse(true);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders discrete simulation pace presets without a numeric spinbutton', async () => {
    renderPanel();

    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByRole('group', { name: 'Playback speed' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Run simulation' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Step' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run all' })).toBeNull();
    expect(screen.queryByText(/\/api\//)).toBeNull();
    expect((screen.getByRole('button', { name: 'Pause' }) as HTMLButtonElement).disabled).toBe(true);

    for (const label of ['10 s/s', '20 s/s', '30 s/s', '60 s/s', '600 s/s', '6000 s/s']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '600 s/s' }).getAttribute('aria-pressed')).toBe('true');
      expect((screen.getByRole('button', { name: '600 s/s' }) as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByText('Running')).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Pause' }) as HTMLButtonElement).disabled).toBe(false);
      expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Resume' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('posts the pace and persists sg-sim-pace when /api/speed succeeds', async () => {
    window.localStorage.setItem('sg-sim-pace', '60');
    mockSpeedResponse(true);

    renderPanel();

    expect(screen.getByRole('button', { name: '60 s/s' }).getAttribute('aria-pressed')).toBe('true');

    await waitFor(() => expect((screen.getByRole('button', { name: '6000 s/s' }) as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: '6000 s/s' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '6000 s/s' }).getAttribute('aria-pressed')).toBe('true');
    });

    const speedCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/speed'));
    expect(speedCall).toBeTruthy();
    const body = JSON.parse((speedCall?.[1]?.body as string) ?? '{}');
    expect(body.sim_seconds_per_real_second).toBe(6000);
    expect(window.localStorage.getItem('sg-sim-pace')).toBe('6000');
    expect(screen.getByText('Speed change: Request accepted.')).toBeTruthy();
  });

  it('keeps the active preset and does not persist when /api/speed fails', async () => {
    window.localStorage.setItem('sg-sim-pace', '60');
    mockSpeedResponse(false);

    renderPanel();

    await waitFor(() => expect((screen.getByRole('button', { name: '6000 s/s' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '6000 s/s' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/speed'))).toBe(true);
      expect((screen.getByRole('button', { name: '6000 s/s' }) as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByRole('alert').textContent).toContain('The request failed. Check the connection and retry.');
    });

    // R10: a rejected pace must not move the active indicator or the stored value.
    expect(screen.getByRole('button', { name: '60 s/s' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '6000 s/s' }).getAttribute('aria-pressed')).toBe('false');
    expect(window.localStorage.getItem('sg-sim-pace')).toBe('60');
  });
});
