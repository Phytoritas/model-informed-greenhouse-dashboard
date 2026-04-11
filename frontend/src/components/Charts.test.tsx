import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../i18n/locale';
import type { SensorData } from '../types';
import Charts from './Charts';

vi.mock('../hooks/useDashboardPerfMetrics', () => ({
  useDashboardPerfMetrics: () => () => undefined,
}));

vi.mock('./TimeSeriesChart', () => ({
  default: ({
    title,
    height,
  }: {
    title: string;
    height?: number;
  }) => <div data-testid="chart-card">{`${title}:${height}`}</div>,
}));

const SENSOR_FIXTURE: SensorData[] = [{
  timestamp: Date.now(),
  temperature: 20.1,
  canopyTemp: 20.4,
  humidity: 78,
  co2: 640,
  light: 510,
  soilMoisture: 51,
  vpd: 0.91,
  transpiration: 2.3,
  stomatalConductance: 0.41,
  photosynthesis: 17.5,
  hFlux: 48,
  leFlux: 83,
  energyUsage: 10.2,
}];

describe('Charts', () => {
  beforeEach(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  });

  it('keeps all five charts in overview while preserving compact height', () => {
    render(
      <LocaleProvider>
        <Charts data={SENSOR_FIXTURE} variant="overview" />
      </LocaleProvider>,
    );

    const cards = screen.getAllByTestId('chart-card');
    expect(cards).toHaveLength(5);
    expect(cards[0].textContent).toBe('Air and canopy temperature:176');
    expect(cards[1].textContent).toBe('Vapor pressure deficit and transpiration:176');
  });

  it('keeps the full chart deck in default mode', () => {
    render(
      <LocaleProvider>
        <Charts data={SENSOR_FIXTURE} />
      </LocaleProvider>,
    );

    expect(screen.getAllByTestId('chart-card')).toHaveLength(5);
  });
});
