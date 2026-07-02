import { fireEvent, render, screen } from '@testing-library/react';
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

  it('restores and persists sg-sim-pace from localStorage', () => {
    window.localStorage.setItem('sg-sim-pace', '60');

    renderPanel();

    expect(screen.getByRole('button', { name: '60 s/s' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '6000 s/s' }));

    expect(window.localStorage.getItem('sg-sim-pace')).toBe('6000');
    expect(screen.getByRole('button', { name: '6000 s/s' }).getAttribute('aria-pressed')).toBe('true');
  });
});
