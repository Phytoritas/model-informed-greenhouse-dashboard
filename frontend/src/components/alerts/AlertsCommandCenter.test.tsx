import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AdvancedModelMetrics, SensorData } from '../../types';
import type { AlertRailItem } from '../dashboard/AlertRail';
import AlertsCommandCenter from './AlertsCommandCenter';

vi.mock('../common/DashboardCard', () => ({
  default: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));

vi.mock('../advisor/AdvisorTabs', () => ({
  default: () => <div>AdvisorTabs</div>,
}));

vi.mock('../dashboard/AlertRail', () => ({
  default: ({ compact }: { compact?: boolean }) => <div>{compact ? 'AlertRail compact' : 'AlertRail full'}</div>,
}));

vi.mock('../dashboard/LiveMetricStrip', () => ({
  default: () => <div>LiveMetricStrip</div>,
}));

const currentData = {
  timestamp: Date.now(),
  temperature: 24,
  humidity: 72,
  co2: 620,
  light: 450,
  vpd: 0.92,
  stomatalConductance: 0.28,
  photosynthesis: 15.4,
} as SensorData;

const metrics = {
  yield: { predictedWeekly: 124 },
  energy: { consumption: 8.2, efficiency: 3.1 },
  growth: { lai: 3.4 },
} as AdvancedModelMetrics;

const alertItems: AlertRailItem[] = [
  { id: 'a-1', severity: 'warning', title: '습도 확인', body: '야간 습도 상승을 확인하세요.' },
];

function renderAlerts(activePanel: 'alerts-protection' | 'alerts-warning' | 'alerts-history') {
  render(
    <AlertsCommandCenter
      locale="ko"
      items={alertItems}
      crop="Cucumber"
      currentData={currentData}
      metrics={metrics}
      telemetryStatus="live"
      statusSummary="정상"
      primaryTiles={[]}
      secondaryTiles={[]}
      activePanel={activePanel}
    />,
  );
}

describe('AlertsCommandCenter tab ownership', () => {
  it('keeps pesticide protection separate from the alert watch rail', () => {
    renderAlerts('alerts-protection');

    expect(screen.getByText('AdvisorTabs')).toBeTruthy();
    expect(screen.queryByText(/AlertRail/)).toBeNull();
  });

  it('renders the alert rail only on the warning tab', () => {
    renderAlerts('alerts-warning');

    expect(screen.getByText('AlertRail full')).toBeTruthy();
    expect(screen.getByText('LiveMetricStrip')).toBeTruthy();
    expect(screen.queryByText('AdvisorTabs')).toBeNull();
  });
});
