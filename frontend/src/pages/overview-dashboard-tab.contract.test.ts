import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8');
}

describe('overview dashboard integration contracts', () => {
  it('uses the shared metric deck for the overview and detailed metrics', () => {
    const routePage = readSource('pages/overview-route-page.tsx');
    const landingSections = readSource('components/dashboard/overviewLandingSections.tsx');

    expect(routePage).toContain('OverviewMetricDeck');
    expect(routePage).not.toContain("from '../components/ui/metric-card'");

    expect(landingSections).toContain('export function OverviewMetricDeck');
    expect(landingSections).toContain('<OverviewMetricDeck');
  });

  it('uses shared chart tokens across environmental, RTR, and decision trends', () => {
    const timeSeriesChart = readSource('components/TimeSeriesChart.tsx');
    const rtrTrendCard = readSource('components/dashboard/RtrTrendCard.tsx');
    const overviewSignalTrendCard = readSource('components/dashboard/OverviewSignalTrendCard.tsx');
    const consultingTrendCard = readSource('components/dashboard/ConsultingTrendCard.tsx');

    for (const source of [
      timeSeriesChart,
      rtrTrendCard,
      overviewSignalTrendCard,
      consultingTrendCard,
    ]) {
      expect(source).toContain('charts/chartStyles');
      expect(source).not.toContain('<CartesianGrid');
      expect(source).toContain('DASHBOARD_CHART_AXIS_PROPS');
      expect(source).toContain('DASHBOARD_CHART_TOOLTIP_STYLE');
    }

  });

  it('composes one decision board without duplicate task feeds or promotional sections', () => {
    const routePage = readSource('pages/overview-route-page.tsx');
    expect(routePage.match(/<TodayActionBoard\b/g)).toHaveLength(1);
    expect(routePage).not.toMatch(/<(TodayBoard|ConsultingTrendCard|FinalCTA|LandingFooter|EnvironmentDatasetCard)\b/);
  });
});
