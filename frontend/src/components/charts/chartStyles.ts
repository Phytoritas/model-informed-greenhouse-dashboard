import { formatLocaleDate, formatLocaleDateTime, formatLocaleTime, type AppLocale } from '../../i18n/locale';

// Dashboard chart styling is derived from the plotkit `biorender_graph` theme
// (skills/plotkit-publication-graphs_phytoritas-legacy-kit/themes/biorender_graph_tokens.yaml).
// `biorender-spec.json` holds the token values so the palette, typography, and
// layout can be re-read or re-generated without editing component code; this
// module is the only place that turns those tokens into Recharts props.
// The JSON file is not imported: `resolveJsonModule` is off in tsconfig.app.json,
// so the tokens are mirrored here as typed constants and
// `dashboardCharts.test.tsx` asserts the two stay in sync.
const spec = {
  fonts: {
    family: "Arial, 'Helvetica Neue', Helvetica, 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    tickSize: 12,
    tickWeight: 400,
    labelSize: 12,
    labelWeight: 700,
    legendSize: 12,
    legendWeight: 500,
    annotationSize: 11,
    textColor: '#171717',
  },
  axes: {
    spineColor: '#293039',
    spineWidth: 1.44,
    visibleSpines: ['left', 'bottom'],
    tickColor: '#293039',
    tickLabelColor: '#3d454e',
    tickLength: 6,
    tickPad: 5,
    labelPad: 8,
    gridEnabled: false,
    ruleColor: 'rgba(41, 48, 57, 0.28)',
  },
  lines: {
    width: 2,
    widthThick: 2.4,
    markerSize: 5,
    markerEdgeWidth: 1,
    interpolation: 'linear',
  },
  bars: {
    width: 0.58,
    edgeWidth: 1.2,
    cornerRadius: 3,
    maxSize: 34,
  },
  legend: {
    placement: 'outside-top',
    frameOn: false,
    swatchWidth: 26,
    swatchHeight: 12,
  },
  layout: {
    background: '#FFFFFF',
    heights: { compact: 240, standard: 264, tall: 300 },
    margin: { top: 8, right: 16, bottom: 4, left: 4 },
  },
  palette: {
    cycle: ['#E35336', '#E2D19B', '#F4A460', '#A0522D'],
    outlineCycle: ['#983523', '#9C927A', '#A5662D', '#66331D'],
    dashCycle: ['', '6 3', '2 3', '10 3 2 3'],
    markerCycle: ['circle', 'square', 'triangle', 'diamond'],
    semantic: {
      control: '#E35336',
      comparison: '#F4A460',
      healthy: '#A0522D',
      neutral: '#94989C',
      adverse: '#E35336',
      risk: '#A0522D',
    },
  },
} as const;

export const CHART_THEME = spec;

/** Arial-first stack with a Korean fallback, per the theme's font contract. */
export const DASHBOARD_CHART_FONT_FAMILY = spec.fonts.family;

/**
 * Left/bottom spine color. The BioRender theme draws real, visible axis lines
 * instead of the faint hairlines the dashboard used before.
 */
export const DASHBOARD_CHART_AXIS_STROKE = spec.axes.spineColor;
export const DASHBOARD_CHART_AXIS_WIDTH = spec.axes.spineWidth;

/**
 * Faint rule used for reference lines and the tooltip cursor. The theme sets
 * `grid_enabled: false`, so no chart draws a CartesianGrid.
 */
export const DASHBOARD_CHART_RULE_STROKE: string = spec.axes.ruleColor;

/**
 * @deprecated The BioRender theme disables gridlines. Retained so existing
 * imports keep resolving; it now paints reference lines and tooltip cursors.
 */
export const DASHBOARD_CHART_GRID_STROKE = DASHBOARD_CHART_RULE_STROKE;

/** Normal-weight, legible tick labels (the theme's `tick_weight: normal`). */
export const DASHBOARD_CHART_TICK = {
  fill: spec.axes.tickLabelColor,
  fontSize: spec.fonts.tickSize,
  fontWeight: spec.fonts.tickWeight,
  fontFamily: DASHBOARD_CHART_FONT_FAMILY,
} as const;

/** Bold axis titles; this is where a series unit belongs. */
export const DASHBOARD_CHART_AXIS_LABEL = {
  fill: spec.fonts.textColor,
  fontSize: spec.fonts.labelSize,
  fontWeight: spec.fonts.labelWeight,
  fontFamily: DASHBOARD_CHART_FONT_FAMILY,
} as const;

/** Smaller annotation text for reference-line callouts. */
export const DASHBOARD_CHART_ANNOTATION = {
  fill: spec.axes.tickLabelColor,
  fontSize: spec.fonts.annotationSize,
  fontWeight: 500,
  fontFamily: DASHBOARD_CHART_FONT_FAMILY,
} as const;

/**
 * Shared XAxis/YAxis props: visible left and bottom spines, visible ticks, and
 * no grid. Spread this so every axis in the dashboard reads the same.
 */
export const DASHBOARD_CHART_AXIS_PROPS = {
  stroke: DASHBOARD_CHART_AXIS_STROKE,
  strokeWidth: DASHBOARD_CHART_AXIS_WIDTH,
  tick: DASHBOARD_CHART_TICK,
  tickLine: { stroke: spec.axes.tickColor, strokeWidth: DASHBOARD_CHART_AXIS_WIDTH },
  tickSize: spec.axes.tickLength,
  tickMargin: spec.axes.tickPad,
  axisLine: { stroke: DASHBOARD_CHART_AXIS_STROKE, strokeWidth: DASHBOARD_CHART_AXIS_WIDTH },
} as const;

/** Hairline cursor for hover; replaces the removed grid as the reading aid. */
export const DASHBOARD_CHART_CURSOR = {
  stroke: DASHBOARD_CHART_RULE_STROKE,
  strokeWidth: 1,
} as const;

export const DASHBOARD_CHART_MARGIN = { ...spec.layout.margin };

/** Desktop chart body heights; `compact` is the 240px floor the theme targets. */
export const DASHBOARD_CHART_HEIGHT = { ...spec.layout.heights };

export const DASHBOARD_CHART_LEGEND_CLASSNAME =
  'flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-medium text-[color:var(--sg-text)]';

export const DASHBOARD_CHART_LEGEND_STYLE = {
  color: spec.fonts.textColor,
  fontFamily: DASHBOARD_CHART_FONT_FAMILY,
  fontSize: `${spec.fonts.legendSize}px`,
  fontWeight: spec.fonts.legendWeight,
  paddingTop: '8px',
} as const;

export const DASHBOARD_CHART_TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: `1px solid ${DASHBOARD_CHART_RULE_STROKE}`,
  borderRadius: '8px',
  boxShadow: '0 12px 28px rgba(23, 23, 23, 0.12)',
  color: spec.fonts.textColor,
  fontFamily: DASHBOARD_CHART_FONT_FAMILY,
  fontSize: '12px',
  padding: '8px 10px',
} as const;

export const DASHBOARD_CHART_TOOLTIP_LABEL_STYLE = {
  color: spec.fonts.textColor,
  fontWeight: 700,
  marginBottom: '4px',
} as const;

export const DASHBOARD_CHART_TOOLTIP_ITEM_STYLE = {
  color: spec.fonts.textColor,
  padding: '1px 0',
} as const;

export type ChartMarkerShape = 'circle' | 'square' | 'triangle' | 'diamond';

export interface ChartSeriesToken {
  /** Index in the BioRender cycle. */
  index: number;
  /** Fill for bars, markers, and legend swatches. */
  fill: string;
  /** Darker series-matched outline, per the theme's `outline_cycle`. */
  outline: string;
  /**
   * Line stroke. Uses the outline color: the pale sand and sandy-brown fills
   * fall below the 3:1 non-text contrast floor as thin strokes on white, while
   * the outline stays legible and keeps the series recognizable.
   */
  line: string;
  /** Dash pattern; '' is solid. Series stay separable in grayscale. */
  dash: string;
  marker: ChartMarkerShape;
}

const SERIES_TOKENS: ChartSeriesToken[] = spec.palette.cycle.map((fill, index) => ({
  index,
  fill,
  outline: spec.palette.outlineCycle[index],
  line: index === 0 ? fill : spec.palette.outlineCycle[index],
  dash: spec.palette.dashCycle[index],
  marker: spec.palette.markerCycle[index] as ChartMarkerShape,
}));

export const CHART_SERIES: readonly ChartSeriesToken[] = SERIES_TOKENS;

/** Series token for position `index`, wrapping around the 4-color cycle. */
export function chartSeries(index: number): ChartSeriesToken {
  const size = SERIES_TOKENS.length;
  const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
  return SERIES_TOKENS[((safeIndex % size) + size) % size];
}

export const CHART_SEMANTIC = { ...spec.palette.semantic };

/**
 * Recharts `<Line>` props for series `index`.
 *
 * `type: 'linear'` avoids the monotone spline overshoot that invents values
 * between samples, and `connectNulls: false` keeps unavailable readings as
 * gaps instead of drawing a line across them.
 */
export function seriesLineProps(index: number) {
  const token = chartSeries(index);
  return {
    type: 'linear' as const,
    stroke: token.line,
    strokeWidth: spec.lines.width,
    strokeDasharray: token.dash || undefined,
    dot: false as const,
    activeDot: {
      r: spec.lines.markerSize / 2 + 1,
      fill: token.fill,
      stroke: token.outline,
      strokeWidth: spec.lines.markerEdgeWidth,
    },
    isAnimationActive: false as const,
    connectNulls: false as const,
  };
}

/** Recharts `<Bar>` props for series `index`, with the series-matched outline. */
export function seriesBarProps(index: number) {
  const token = chartSeries(index);
  return {
    fill: token.fill,
    stroke: token.outline,
    strokeWidth: spec.bars.edgeWidth,
    radius: [spec.bars.cornerRadius, spec.bars.cornerRadius, 0, 0] as [number, number, number, number],
    maxBarSize: spec.bars.maxSize,
    isAnimationActive: false as const,
  };
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Every chart axis is read in greenhouse local time so the tick labels match
 * the 3D twin's replay clock regardless of the viewer's browser timezone.
 */
export const CHART_TIME_ZONE = 'Asia/Seoul';

/**
 * KST is a fixed UTC+9 offset with no daylight saving, so hour and day
 * boundaries can be computed by shifting the epoch instead of going through a
 * local-time `Date`.
 */
const CHART_TIME_ZONE_OFFSET_MS = 9 * HOUR_MS;

const ZONED_DATE_OPTIONS = { timeZone: CHART_TIME_ZONE } as const;

/** Tick steps in ascending order, so a span picks the coarsest readable one. */
const HOUR_STEPS_MS = [HOUR_MS, 2 * HOUR_MS, 3 * HOUR_MS, 6 * HOUR_MS, 12 * HOUR_MS];

/** Spans at or above this get day-anchored ticks instead of hour-only labels. */
export const MULTI_DAY_SPAN_MS = 36 * HOUR_MS;

export interface TimeAxisPlan {
  domain: [number, number];
  ticks: number[];
  spanMs: number;
  multiDay: boolean;
}

function startOfHour(timestamp: number): number {
  return Math.floor(timestamp / HOUR_MS) * HOUR_MS;
}

/** Midnight in `CHART_TIME_ZONE`, returned as an epoch timestamp. */
function startOfDay(timestamp: number): number {
  const shifted = timestamp + CHART_TIME_ZONE_OFFSET_MS;
  return Math.floor(shifted / DAY_MS) * DAY_MS - CHART_TIME_ZONE_OFFSET_MS;
}

/**
 * Builds a numeric time axis whose tick spacing reflects real elapsed time.
 *
 * Ticks are anchored to local hour or day boundaries, so a multi-day window
 * shows dates at day starts rather than repeating the same hour label on every
 * day. Returns null when there is nothing to plot.
 */
export function buildTimeAxisPlan(
  timestamps: number[],
  targetTickCount = 5,
): TimeAxisPlan | null {
  const finite = timestamps.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const spanMs = max - min;

  if (spanMs <= 0) {
    return { domain: [min, min], ticks: [min], spanMs: 0, multiDay: false };
  }

  const multiDay = spanMs >= MULTI_DAY_SPAN_MS;
  const ticks: number[] = [];

  if (multiDay) {
    const dayStep = Math.max(1, Math.round(spanMs / DAY_MS / targetTickCount));
    let cursor = startOfDay(min);
    if (cursor < min) {
      cursor += DAY_MS;
    }
    while (cursor <= max) {
      ticks.push(cursor);
      cursor = startOfDay(cursor + dayStep * DAY_MS);
    }
  } else {
    const rawStep = spanMs / targetTickCount;
    const step = HOUR_STEPS_MS.find((candidate) => candidate >= rawStep) ?? HOUR_MS;
    let cursor = startOfHour(min);
    if (cursor < min) {
      cursor += step;
    }
    while (cursor <= max) {
      ticks.push(cursor);
      cursor += step;
    }
  }

  if (ticks.length < 2) {
    ticks.length = 0;
    ticks.push(min, max);
  }

  return { domain: [min, max], ticks, spanMs, multiDay };
}

/**
 * Tick label for a numeric time axis: clock time within a day, and a date at
 * day boundaries once the window spans more than a day.
 */
export function formatTimeAxisTick(
  locale: AppLocale,
  timestamp: number,
  multiDay: boolean,
): string {
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  if (!multiDay) {
    return formatLocaleTime(locale, timestamp, {
      ...ZONED_DATE_OPTIONS,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (timestamp === startOfDay(timestamp)) {
    return formatLocaleDate(locale, timestamp, {
      ...ZONED_DATE_OPTIONS,
      month: 'numeric',
      day: 'numeric',
    });
  }
  return formatLocaleDateTime(locale, timestamp, {
    ...ZONED_DATE_OPTIONS,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Full timestamp for tooltips and cursor callouts. */
export function formatTimeAxisLabel(locale: AppLocale, timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  return formatLocaleDateTime(locale, timestamp, {
    ...ZONED_DATE_OPTIONS,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
