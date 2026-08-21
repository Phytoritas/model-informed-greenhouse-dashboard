import type { SensorData } from '../types';

const HOUR_MS = 60 * 60 * 1000;
const RECENT_WINDOW_MS = 2 * HOUR_MS;
const BASELINE_HALF_WINDOW_MS = 90 * 60 * 1000;
const CONTEXT_WINDOW_MS = 30 * HOUR_MS;

function validTimestamp(point: SensorData): number | null {
  const timestamp = Number(point.timestamp);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function sampleEvenly<T>(values: T[], limit: number): T[] {
  if (limit <= 0 || values.length === 0) return [];
  if (values.length <= limit) return values;
  if (limit === 1) return [values[values.length - 1]];

  const selected: T[] = [];
  const step = (values.length - 1) / (limit - 1);
  for (let index = 0; index < limit; index += 1) {
    selected.push(values[Math.round(index * step)]);
  }
  return selected;
}

/**
 * Build the bounded history payload needed by the adaptive advisor.
 *
 * It preserves the current two-hour window and the same-time previous-day
 * window before filling the remaining budget with a stratified 30-hour context.
 * This fixes the old path that sent only `recentSummary`, which could not answer
 * "why is this morning different from yesterday at the same time?"
 */
export function buildAdaptiveHistoryPayload(
  currentData: SensorData,
  history: SensorData[] = [],
  maxPoints = 360,
): SensorData[] {
  const byTimestamp = new Map<number, SensorData>();
  for (const point of [...history, currentData]) {
    const timestamp = validTimestamp(point);
    if (timestamp === null) continue;
    byTimestamp.set(timestamp, point);
  }

  const ordered = [...byTimestamp.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, point]) => point);
  if (ordered.length === 0 || maxPoints <= 0) return [];

  const reference = validTimestamp(currentData)
    ?? validTimestamp(ordered[ordered.length - 1])
    ?? Date.now();
  const previousCenter = reference - 24 * HOUR_MS;

  const recent = ordered.filter((point) => {
    const timestamp = validTimestamp(point);
    return timestamp !== null
      && timestamp >= reference - RECENT_WINDOW_MS
      && timestamp <= reference;
  });
  const previousDay = ordered.filter((point) => {
    const timestamp = validTimestamp(point);
    return timestamp !== null
      && timestamp >= previousCenter - BASELINE_HALF_WINDOW_MS
      && timestamp <= previousCenter + BASELINE_HALF_WINDOW_MS;
  });

  const priorityMap = new Map<number, SensorData>();
  for (const point of [...previousDay, ...recent]) {
    const timestamp = validTimestamp(point);
    if (timestamp !== null) priorityMap.set(timestamp, point);
  }
  let priority = [...priorityMap.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, point]) => point);

  if (priority.length > maxPoints) {
    const previousBudget = Math.max(1, Math.floor(maxPoints / 2));
    const recentBudget = Math.max(1, maxPoints - previousBudget);
    priority = [
      ...sampleEvenly(previousDay, previousBudget),
      ...sampleEvenly(recent, recentBudget),
    ];
  }

  const selected = new Map<number, SensorData>();
  for (const point of priority) {
    const timestamp = validTimestamp(point);
    if (timestamp !== null) selected.set(timestamp, point);
  }

  const remainingBudget = Math.max(0, maxPoints - selected.size);
  if (remainingBudget > 0) {
    const context = ordered.filter((point) => {
      const timestamp = validTimestamp(point);
      return timestamp !== null
        && timestamp >= reference - CONTEXT_WINDOW_MS
        && timestamp <= reference
        && !selected.has(timestamp);
    });
    for (const point of sampleEvenly(context, remainingBudget)) {
      const timestamp = validTimestamp(point);
      if (timestamp !== null) selected.set(timestamp, point);
    }
  }

  return [...selected.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, point]) => point)
    .slice(-maxPoints);
}
