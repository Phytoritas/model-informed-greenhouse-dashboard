import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8');
}

describe('PRD-003 HOME Dashboard tab contracts', () => {
  it('verify_src001_s0003_r001_a01 shares the Command LIVE OVERVIEW metric tile renderer with dashboardTab', () => {
    const routePage = readSource('pages/overview-route-page.tsx');
    const landingSections = readSource('components/dashboard/overviewLandingSections.tsx');
    const metricCard = readSource('components/ui/metric-card.tsx');

    expect(routePage).toContain('OverviewMetricDeck');
    expect(routePage).toContain('<OverviewMetricDeck tiles={allMetricTiles} />');
    expect(routePage).not.toContain("from '../components/ui/metric-card'");

    expect(landingSections).toContain('export function OverviewMetricDeck');
    expect(landingSections).toContain('<OverviewMetricDeck');
    expect(landingSections).toContain('tile.value');
    expect(landingSections).toContain("detail={tile.lastReceived ?? tile.availabilityLabel}");
    expect(landingSections).toContain("trendLabel={compactTrendLabel(tile.trendDetail) || tile.availabilityLabel}");
    expect(landingSections).toContain('tone={tone}');

    expect(metricCard).toContain("export type MetricTone = 'growth' | 'stable' | 'warning' | 'critical' | 'muted'");
    // Tone → surface-tint map moved to the shared utils/metricTone helper so the
    // Command MetricCard and the alerts LiveMetricStrip converge on one mapping.
    expect(metricCard).toContain('metricToneSurfaceClass');
    expect(metricCard).toContain('<StatusChip');
    expect(metricCard).toContain('sg-data-number');
  });

  it('verify_src001_s0003_r002_a01 renders Dashboard charts and trend cards as sg-panel cards with shared headers and chart tones', () => {
    const charts = readSource('components/Charts.tsx');
    const timeSeriesChart = readSource('components/TimeSeriesChart.tsx');
    const rtrTrendCard = readSource('components/dashboard/RtrTrendCard.tsx');
    const overviewSignalTrendCard = readSource('components/dashboard/OverviewSignalTrendCard.tsx');
    const consultingTrendCard = readSource('components/dashboard/ConsultingTrendCard.tsx');
    const modelRuntimeBridge = readSource('components/dashboard/ModelRuntimeBridge.tsx');
    const chartStyles = readSource('components/charts/chartStyles.ts');

    for (const source of [
      charts,
      timeSeriesChart,
      rtrTrendCard,
      overviewSignalTrendCard,
      consultingTrendCard,
      modelRuntimeBridge,
    ]) {
      expect(source).toContain('sg-panel');
      expect(source).toMatch(/sg-eyebrow|eyebrow=\{copy\.eyebrow\}/);
    }

    for (const source of [
      timeSeriesChart,
      rtrTrendCard,
      overviewSignalTrendCard,
      consultingTrendCard,
    ]) {
      expect(source).toContain('DASHBOARD_CHART_GRID_STROKE');
      expect(source).toContain('DASHBOARD_CHART_AXIS_STROKE');
      expect(source).toContain('DASHBOARD_CHART_TICK');
      expect(source).toContain('DASHBOARD_CHART_TOOLTIP_STYLE');
    }

    expect(timeSeriesChart).toContain('Legend');
    expect(timeSeriesChart).toContain('DASHBOARD_CHART_LEGEND_STYLE');
    expect(rtrTrendCard).toContain('DASHBOARD_CHART_LEGEND_CLASSNAME');
    expect(overviewSignalTrendCard).toContain('DASHBOARD_CHART_LEGEND_CLASSNAME');
    expect(consultingTrendCard).toContain('DASHBOARD_CHART_LEGEND_CLASSNAME');
    expect(modelRuntimeBridge).toContain('<RuntimeCard');
    expect(modelRuntimeBridge).toContain('<p className="sg-eyebrow truncate">{card.endpoint}</p>');

    expect(chartStyles).toContain("fill: 'var(--sg-text-faint)'");
    expect(chartStyles).toContain("color: 'var(--sg-text-muted)'");
  });

  it('verify_src001_s0003_r003_a01 keeps the redesigned Dashboard tab overflow-safe across capture viewports', () => {
    const routePage = readSource('pages/overview-route-page.tsx');
    const indexCss = readSource('index.css');
    const chartFrame = readSource('components/charts/ChartFrame.tsx');
    const charts = readSource('components/Charts.tsx');
    const rtrTrendCard = readSource('components/dashboard/RtrTrendCard.tsx');
    const overviewSignalTrendCard = readSource('components/dashboard/OverviewSignalTrendCard.tsx');
    const consultingTrendCard = readSource('components/dashboard/ConsultingTrendCard.tsx');
    const modelRuntimeBridge = readSource('components/dashboard/ModelRuntimeBridge.tsx');

    expect(routePage).toContain('grid min-w-0 gap-4 xl:grid-cols-12');
    expect(routePage).toContain('min-w-0 xl:col-span-7');
    expect(routePage).toContain('min-w-0 space-y-4 xl:col-span-5');
    expect(routePage).toContain('min-w-0 xl:col-span-12');

    expect(indexCss).toContain('.overview-metric-row');
    expect(indexCss).toContain('grid-template-columns: repeat(1, minmax(0, 1fr))');
    expect(indexCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(indexCss).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
    expect(indexCss).toContain('.overview-card-row-4');
    expect(indexCss).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');

    expect(chartFrame).toContain("cn('w-full min-w-0'");
    expect(charts).toContain('grid min-w-0');
    for (const source of [rtrTrendCard, overviewSignalTrendCard, consultingTrendCard, modelRuntimeBridge]) {
      expect(source).toContain('min-w-0');
    }
  });
});
