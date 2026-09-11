import { render, screen, within } from '@testing-library/react';
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
    unitLabel,
    dataKeys,
    data,
    selectedTimestamp,
    compact,
  }: {
    title: string;
    unitLabel?: string;
    dataKeys: Array<{ key: string; name: string }>;
    data: SensorData[];
    selectedTimestamp?: number | null;
    compact?: boolean;
  }) => <section
    aria-label={title}
    data-testid="chart-card"
    data-unit={unitLabel}
    data-compact={compact ? 'true' : 'false'}
    data-series={JSON.stringify(dataKeys.map(({ key }) => key))}
    data-timestamps={JSON.stringify(data.map(({ timestamp }) => timestamp))}
    data-selected-timestamp={selectedTimestamp}
  />,
}));

const SENSOR_FIXTURE: SensorData[] = [{
  timestamp: Date.UTC(2026, 3, 9, 9),
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

  it.each(['overview', 'default'] as const)('shows every %s chart at once with one physical unit per chart', (variant) => {
    render(
      <LocaleProvider>
        <Charts data={SENSOR_FIXTURE} variant={variant} />
      </LocaleProvider>,
    );

    // No topic tabs: every chart is on screen at the same time.
    expect(screen.queryAllByRole('tab')).toHaveLength(0);

    const grid = screen.getByRole('group', { name: 'Climate and crop charts' });
    expect(within(grid).getAllByTestId('chart-card').map((card) => [
      card.getAttribute('aria-label'),
      card.getAttribute('data-unit'),
      JSON.parse(card.getAttribute('data-series') ?? '[]'),
    ])).toEqual([
      ['Air and canopy temperature', '°C', ['temperature', 'canopyTemp']],
      ['Vapor pressure deficit', 'kPa', ['vpd']],
      ['Stomatal conductance', 'mol H₂O m⁻² s⁻¹', ['stomatalConductance']],
      ['Gross photosynthesis', 'µmol m⁻² s⁻¹', ['photosynthesis']],
      ['Transpiration', 'mm H₂O h⁻¹', ['transpiration']],
      ['Energy balance', 'W m⁻²', ['hFlux', 'leFlux']],
      ['Electrical demand', 'kW', ['energyUsage']],
    ]);

    for (const card of within(grid).getAllByTestId('chart-card')) {
      expect(card.getAttribute('data-compact')).toBe('true');
    }
  });

  it('renders the supplied RTR comparison once alongside the chart grid', () => {
    render(
      <LocaleProvider>
        <Charts
          data={SENSOR_FIXTURE}
          variant="overview"
          extraChartSlot={<div data-testid="rtr-chart-slot">RTR trend</div>}
        />
      </LocaleProvider>,
    );

    const grid = screen.getByRole('group', { name: 'Climate and crop charts' });
    expect(screen.getAllByTestId('rtr-chart-slot')).toHaveLength(1);
    expect(within(grid).getByTestId('rtr-chart-slot').textContent).toBe('RTR trend');
    expect(within(grid).getAllByTestId('chart-card')).toHaveLength(7);
  });

  it('forwards the selected simulation instant without truncating the plotted history', () => {
    const selectedTimestamp = SENSOR_FIXTURE[0].timestamp;
    const history = [...SENSOR_FIXTURE, { ...SENSOR_FIXTURE[0], timestamp: selectedTimestamp + 60_000 }];
    render(
      <LocaleProvider>
        <Charts data={history} selectedTimestamp={selectedTimestamp} />
      </LocaleProvider>,
    );

    const cards = screen.getAllByTestId('chart-card');
    expect(cards).toHaveLength(7);
    for (const card of cards) {
      expect(card.getAttribute('data-selected-timestamp')).toBe(String(selectedTimestamp));
      expect(JSON.parse(card.getAttribute('data-timestamps') ?? '[]')).toEqual(history.map(({ timestamp }) => timestamp));
    }
  });
});
