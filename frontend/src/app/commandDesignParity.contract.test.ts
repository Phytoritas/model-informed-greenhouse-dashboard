import { describe, expect, it } from 'vitest';

import decisionSnapshotGridSource from '../components/dashboard/DecisionSnapshotGrid.tsx?raw';
import dashboardCardSource from '../components/common/DashboardCard.tsx?raw';
import metricCardSource from '../components/ui/metric-card.tsx?raw';
import overviewRoutePageSource from '../pages/overview-route-page.tsx?raw';
import producePricesPanelSource from '../components/ProducePricesPanel.tsx?raw';
import sectionHeaderSource from '../components/ui/section-header.tsx?raw';
import statusChipSource from '../components/ui/status-chip.tsx?raw';
import trendPageSource from '../pages/trend-page.tsx?raw';
import trendRoutePageSource from '../pages/trend-route-page.tsx?raw';
import weatherOutlookPanelSource from '../components/WeatherOutlookPanel.tsx?raw';
import weatherTrendPanelSource from '../components/dashboard/WeatherTrendPanel.tsx?raw';
import { COMMAND_DESIGN_PARITY_CONTRACT } from './commandDesignParity';

describe('PRD-001 command design parity contract', () => {
  it('verify_src001_s0001_a01 records the issue and base stack contract', () => {
    expect(COMMAND_DESIGN_PARITY_CONTRACT.storyId).toBe('PRD-001');
    expect(COMMAND_DESIGN_PARITY_CONTRACT.issueId).toBe('#133');
    expect(COMMAND_DESIGN_PARITY_CONTRACT.stackBase).toMatchObject({
      branch: 'fix/132',
      requestedTip: '02292d1',
      rederivedHead: '536a3e8',
    });
  });

  it('verify_src001_s0001_a02 marks /overview Dashboard and Watch plus /trend panels as Command parity surfaces', () => {
    expect(COMMAND_DESIGN_PARITY_CONTRACT.canonicalSurface).toEqual({
      path: '/overview',
      tab: 'Command',
    });
    expect(COMMAND_DESIGN_PARITY_CONTRACT.paritySurfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/overview', tab: 'Dashboard', marker: 'overview-dashboard' }),
        expect.objectContaining({ path: '/overview', tab: 'Watch', marker: 'overview-watch' }),
        expect.objectContaining({ path: '/trend', panel: 'WeatherTrendPanel', marker: 'trend-weather' }),
        expect.objectContaining({ path: '/trend', panel: 'WeatherOutlookPanel', marker: 'trend-weather' }),
        expect.objectContaining({ path: '/trend', panel: 'ProducePricesPanel', marker: 'trend-market' }),
        expect.objectContaining({ path: '/trend', panel: 'DecisionSnapshotGrid', marker: 'trend-decision' }),
      ]),
    );

    expect(overviewRoutePageSource).toContain('data-command-surface="overview-dashboard"');
    expect(overviewRoutePageSource).toContain('data-command-surface="overview-watch"');
    expect(overviewRoutePageSource).toContain("from '../components/ui/section-header'");
    expect(trendPageSource).toContain('data-command-surface="trend-weather"');
    expect(trendPageSource).toContain('data-command-surface="trend-market"');
    expect(trendPageSource).toContain('data-command-surface="trend-decision"');
    expect(trendPageSource).toContain("from '../components/ui/section-header'");
    expect(trendRoutePageSource).toContain('WeatherTrendPanel');
    expect(trendRoutePageSource).toContain('WeatherOutlookPanel');
    expect(trendRoutePageSource).toContain('ProducePricesPanel');
    expect(trendRoutePageSource).toContain('DecisionSnapshotGrid');
  });

  it('verify_src001_s0001_a03 keeps Command metrics, section intros, and status tones on the shared kit', () => {
    expect(COMMAND_DESIGN_PARITY_CONTRACT.designLanguage.requiredClasses).toEqual([
      'sg-data-number',
      'sg-eyebrow',
    ]);
    expect(COMMAND_DESIGN_PARITY_CONTRACT.designLanguage.sharedComponents).toEqual([
      'DashboardCard',
      'MetricCard',
      'SectionHeader',
      'StatusChip',
    ]);
    expect(COMMAND_DESIGN_PARITY_CONTRACT.designLanguage.statusChipTones).toEqual([
      'growth',
      'stable',
      'warning',
      'critical',
      'muted',
    ]);
    expect(COMMAND_DESIGN_PARITY_CONTRACT.designLanguage.palette).toEqual([
      'ivory',
      'sage',
      'tomato',
    ]);

    for (const source of [
      metricCardSource,
      weatherOutlookPanelSource,
      producePricesPanelSource,
      decisionSnapshotGridSource,
    ]) {
      expect(source).toContain('sg-data-number');
      expect(source).toContain('StatusChip');
    }
    expect(weatherTrendPanelSource).toContain('MetricCard');
    expect(weatherTrendPanelSource).toContain('StatusChip');

    for (const source of [
      dashboardCardSource,
      weatherOutlookPanelSource,
      producePricesPanelSource,
      weatherTrendPanelSource,
      sectionHeaderSource,
    ]) {
      expect(source).toContain('sg-eyebrow');
    }
    expect(decisionSnapshotGridSource).toContain('DashboardCard');
    expect(decisionSnapshotGridSource).toContain('eyebrow={copy.eyebrow}');

    expect(statusChipSource).toContain('export type StatusChipTone');
    expect(decisionSnapshotGridSource).toContain('type StatusChipTone');
    expect(dashboardCardSource).toContain('extends HTMLAttributes<HTMLElement>');
    expect(weatherOutlookPanelSource).toContain('data-testid="weather-provider-status-chip"');
    expect(producePricesPanelSource).toContain('tone: StatusChipTone');
    expect(producePricesPanelSource).toMatch(/up:\s*\{[\s\S]*?tone: 'growth'/);
    expect(producePricesPanelSource).toMatch(/down:\s*\{[\s\S]*?tone: 'critical'/);
    expect(producePricesPanelSource).toMatch(/flat:\s*\{[\s\S]*?tone: 'stable'/);
  });
});
