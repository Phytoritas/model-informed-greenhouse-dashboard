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
  fetchMock.mockResolvedValue({
    ok,
    status: ok ? 200 : 422,
    statusText: ok ? 'OK' : 'Unprocessable Entity',
    json: async () => (ok ? { status: 'success' } : { detail: 'invalid pace' }),
  });
}

describe('SimulationRuntimePanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders discrete simulation pace presets without a numeric spinbutton', () => {
    renderPanel();

    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByRole('group', { name: 'Speed' })).toBeTruthy();

    for (const label of ['10 s/s', '20 s/s', '30 s/s', '60 s/s', '600 s/s', '6000 s/s']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }

    expect(screen.getByRole('button', { name: '600 s/s' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('posts the pace and persists sg-sim-pace when /api/speed succeeds', async () => {
    window.localStorage.setItem('sg-sim-pace', '60');
    mockSpeedResponse(true);

    renderPanel();

    expect(screen.getByRole('button', { name: '60 s/s' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '6000 s/s' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '6000 s/s' }).getAttribute('aria-pressed')).toBe('true');
    });

    const speedCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/speed'));
    expect(speedCall).toBeTruthy();
    const body = JSON.parse((speedCall?.[1]?.body as string) ?? '{}');
    expect(body.sim_seconds_per_real_second).toBe(6000);
    expect(window.localStorage.getItem('sg-sim-pace')).toBe('6000');
  });

  it('keeps the active preset and does not persist when /api/speed fails', async () => {
    window.localStorage.setItem('sg-sim-pace', '60');
    mockSpeedResponse(false);

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: '6000 s/s' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/speed'))).toBe(true);
    });

    // R10: a rejected pace must not move the active indicator or the stored value.
    expect(screen.getByRole('button', { name: '60 s/s' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '6000 s/s' }).getAttribute('aria-pressed')).toBe('false');
    expect(window.localStorage.getItem('sg-sim-pace')).toBe('60');
  });
});
