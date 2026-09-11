import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildTimeAxisPlan,
  CHART_SERIES,
  CHART_THEME,
  CHART_TIME_ZONE,
  chartSeries,
  DASHBOARD_CHART_AXIS_PROPS,
  DASHBOARD_CHART_FONT_FAMILY,
  DASHBOARD_CHART_HEIGHT,
  formatTimeAxisTick,
  MULTI_DAY_SPAN_MS,
  seriesBarProps,
  seriesLineProps,
} from './chartStyles';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Token values from the JSON source, without its provenance metadata. */
function readSpecTokens(): Record<string, unknown> {
  const parsed = JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/components/charts/biorender-spec.json'), 'utf8'),
  ) as Record<string, unknown>;
  const { theme, source, note, ...tokens } = parsed;
  void theme;
  void source;
  void note;
  return tokens;
}

describe('dashboard chart theme', () => {
  it('mirrors biorender-spec.json, which stays the token source of truth', () => {
    // tsconfig.app.json has resolveJsonModule off, so chartStyles cannot import
    // the JSON directly. This keeps the inlined copy honest.
    expect(JSON.parse(JSON.stringify(CHART_THEME))).toEqual(readSpecTokens());
  });

  it('uses the BioRender palette with an Arial-first Korean-capable font stack', () => {
    expect(CHART_SERIES.map((series) => series.fill).join(',')).toBe(
      '#E35336,#E2D19B,#F4A460,#A0522D',
    );
    expect(DASHBOARD_CHART_FONT_FAMILY.startsWith('Arial')).toBe(true);
    expect(DASHBOARD_CHART_FONT_FAMILY).toContain('Malgun Gothic');
  });

  it('separates every series by dash and marker so charts survive grayscale', () => {
    const dashes = CHART_SERIES.map((series) => series.dash);
    const markers = CHART_SERIES.map((series) => series.marker);
    expect(new Set(dashes).size).toBe(CHART_SERIES.length);
    expect(new Set(markers).size).toBe(CHART_SERIES.length);
  });

  it('wraps the series cycle instead of running out of colors', () => {
    expect(chartSeries(4).fill).toBe(chartSeries(0).fill);
    expect(chartSeries(-1).fill).toBe(chartSeries(3).fill);
  });

  it('draws visible left and bottom spines and no gridlines', () => {
    expect(CHART_THEME.axes.gridEnabled).toBe(false);
    expect(CHART_THEME.axes.visibleSpines.join(',')).toBe('left,bottom');
    expect(typeof DASHBOARD_CHART_AXIS_PROPS.axisLine).toBe('object');
    expect(typeof DASHBOARD_CHART_AXIS_PROPS.tickLine).toBe('object');
  });

  it('keeps ticks legible at normal weight and axis labels bold', () => {
    expect(DASHBOARD_CHART_AXIS_PROPS.tick.fontSize).toBeGreaterThanOrEqual(12);
    expect(DASHBOARD_CHART_AXIS_PROPS.tick.fontWeight).toBe(400);
    expect(CHART_THEME.fonts.labelWeight).toBe(700);
  });

  it('gives desktop charts at least 240px of plot height', () => {
    expect(DASHBOARD_CHART_HEIGHT.compact).toBeGreaterThanOrEqual(240);
  });

  it('plots straight segments and leaves unavailable samples as gaps', () => {
    const line = seriesLineProps(0);
    // A monotone spline overshoots between samples and implies readings the
    // sensor never reported.
    expect(line.type).toBe('linear');
    // connectNulls would bridge a missing sample, which reads as measured data.
    expect(line.connectNulls).toBe(false);
  });

  it('outlines bars in the series color, per the theme', () => {
    const bar = seriesBarProps(1);
    expect(bar.fill).toBe(CHART_SERIES[1].fill);
    expect(bar.stroke).toBe(CHART_SERIES[1].outline);
  });
});

describe('time axis', () => {
  it('spaces ticks by real elapsed time rather than by sample index', () => {
    const start = Date.UTC(2026, 3, 25, 0, 0, 0);
    // Dense in the first ten minutes, then a long gap.
    const plan = buildTimeAxisPlan([
      start,
      start + 5 * 60 * 1000,
      start + 10 * 60 * 1000,
      start + 11 * HOUR_MS,
    ]);

    expect(plan).not.toBeNull();
    expect(plan?.domain.join(',')).toBe([start, start + 11 * HOUR_MS].join(','));
    const ticks = plan?.ticks ?? [];
    const gaps = ticks.slice(1).map((tick, index) => tick - ticks[index]);
    expect(new Set(gaps).size).toBe(1);
  });

  it('labels a multi-day window with dates instead of repeating hour labels', () => {
    const start = Date.UTC(2026, 3, 25, 0, 0, 0);
    const plan = buildTimeAxisPlan([start, start + 3 * DAY_MS]);

    expect(plan?.multiDay).toBe(true);
    const labels = (plan?.ticks ?? []).map((tick) => formatTimeAxisTick('en', tick, true));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('keeps hour-only labels inside a single day', () => {
    const start = Date.UTC(2026, 3, 25, 0, 0, 0);
    const plan = buildTimeAxisPlan([start, start + 6 * HOUR_MS]);

    expect(plan?.multiDay).toBe(false);
    expect(plan?.spanMs ?? Number.POSITIVE_INFINITY).toBeLessThan(MULTI_DAY_SPAN_MS);
  });

  it('anchors day ticks to greenhouse local time, not the viewer timezone', () => {
    expect(CHART_TIME_ZONE).toBe('Asia/Seoul');
    // 2026-04-25T15:00Z is 2026-04-26T00:00 in KST.
    const kstMidnight = Date.UTC(2026, 3, 25, 15, 0, 0);
    const plan = buildTimeAxisPlan([kstMidnight - DAY_MS, kstMidnight + 2 * DAY_MS]);

    expect(plan?.ticks ?? []).toContain(kstMidnight);
    expect(formatTimeAxisTick('en', kstMidnight, true)).toBe('4/26');
  });

  it('returns null when there is nothing to plot', () => {
    expect(buildTimeAxisPlan([])).toBeNull();
    expect(buildTimeAxisPlan([Number.NaN])).toBeNull();
  });
});
