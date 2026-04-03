import type { RecentSeriesSummary, SensorData, VariableSummary, TrendLabel } from '../types';

type NumericKey = keyof SensorData;

const DEFAULT_KEYS: NumericKey[] = [
  'temperature',
  'canopyTemp',
  'humidity',
  'co2',
  'light',
  'soilMoisture',
  'vpd',
  'transpiration',
  'stomatalConductance',
  'photosynthesis',
  'hFlux',
  'leFlux',
  'energyUsage',
];

function hasMeaningfulCurrentData(data?: SensorData | null): data is SensorData {
  if (!data) return false;

  return DEFAULT_KEYS.some((key) => {
    if (key === 'timestamp') return false;
    const value = data[key];
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) > 1e-9;
  });
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function min(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => (b < a ? b : a), values[0]);
}

function max(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => (b > a ? b : a), values[0]);
}

function maxStepAbs(values: number[]): number {
  let m = 0;
  for (let i = 1; i < values.length; i += 1) {
    const d = Math.abs(values[i] - values[i - 1]);
    if (d > m) m = d;
  }
  return m;
}

function trendLabel(delta: number, range: number): TrendLabel {
  // Heuristic: consider "flat" unless the end-to-start change is meaningful.
  // Avoid per-variable hardcoded thresholds; use range-adaptive check.
  const eps = Math.max(1e-9, range * 0.25);
  if (Math.abs(delta) < eps) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

function summarizeVariable(values: number[], durationHours: number): VariableSummary {
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const vMin = min(values);
  const vMax = max(values);
  const vMean = mean(values);
  const delta = last - first;
  const slopePerH = durationHours > 0 ? delta / durationHours : 0;
  const stepAbs = maxStepAbs(values);
  const t = trendLabel(delta, vMax - vMin);

  return {
    first,
    last,
    min: vMin,
    max: vMax,
    mean: vMean,
    delta,
    slope_per_h: slopePerH,
    max_step_abs: stepAbs,
    trend: t,
  };
}

export function buildRecentSeriesSummary(
  history: SensorData[],
  maxPoints = 60,
  keys: NumericKey[] = DEFAULT_KEYS,
): RecentSeriesSummary {
  const points = history.slice(-maxPoints);
  const n = points.length;

  const start_ts = n > 0 ? points[0].timestamp : Date.now();
  const end_ts = n > 0 ? points[n - 1].timestamp : start_ts;
  const durationMs = Math.max(0, end_ts - start_ts);
  const duration_min = durationMs / 60000;
  const avg_dt_min = n > 1 ? duration_min / (n - 1) : 0;
  const durationHours = durationMs / 3600000;

  const variables: Record<string, VariableSummary> = {};

  for (const key of keys) {
    if (key === 'timestamp') continue;
    const values = points
      .map(p => (typeof p[key] === 'number' ? (p[key] as number) : NaN))
      .filter(v => Number.isFinite(v));
    if (values.length === 0) continue;
    variables[String(key)] = summarizeVariable(values, durationHours);
  }

  return {
    n,
    start_ts,
    end_ts,
    duration_min,
    avg_dt_min,
    variables,
  };
}

export function buildDashboardRecentSummary(
  currentData: SensorData | null | undefined,
  history: SensorData[] = [],
  maxPoints = 60,
  keys: NumericKey[] = DEFAULT_KEYS,
): RecentSeriesSummary {
  const summarySource = history.length > 0
    ? history
    : (hasMeaningfulCurrentData(currentData) ? [currentData] : []);

  return buildRecentSeriesSummary(summarySource, maxPoints, keys);
}

