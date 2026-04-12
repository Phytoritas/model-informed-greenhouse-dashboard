import type { OverviewSourceSinkPoint } from '../types';

function clampBalance(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function normalizeOverviewSourceSinkBalance(point: OverviewSourceSinkPoint): number {
  const sourceCapacity = Number(point.source_capacity);
  const sinkDemand = Number(point.sink_demand);

  if (Number.isFinite(sourceCapacity) && Number.isFinite(sinkDemand)) {
    const normalizedSource = Math.max(0, sourceCapacity);
    const normalizedSink = Math.max(0, sinkDemand);
    const denominator = Math.max(normalizedSource + normalizedSink, 1e-9);
    return clampBalance((normalizedSource - normalizedSink) / denominator);
  }

  const rawBalance = Number(point.source_sink_balance);
  if (!Number.isFinite(rawBalance)) {
    return 0;
  }

  return clampBalance(rawBalance);
}

export function getLatestOverviewSourceSinkBalance(
  points: OverviewSourceSinkPoint[] | null | undefined,
): number | null {
  if (!points?.length) {
    return null;
  }

  let latestTimestamp = Number.NEGATIVE_INFINITY;
  let latestValue: number | null = null;

  points.forEach((point) => {
    const timestamp = new Date(point.time).getTime();
    if (!Number.isFinite(timestamp) || timestamp < latestTimestamp) {
      return;
    }

    latestTimestamp = timestamp;
    latestValue = normalizeOverviewSourceSinkBalance(point);
  });

  return latestValue;
}
