export function pickNumericSeries<T extends object>(
  rows: T[] | null | undefined,
  key: keyof T | string,
  limit = 24,
): number[] {
  if (!rows?.length) {
    return [];
  }

  return rows
    .slice(-limit)
    .map((row) => (row as Record<string, unknown>)[String(key)])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export function appendFiniteValue(series: number[], value: number | null | undefined, limit = 24): number[] {
  const next = [...series];
  if (typeof value === 'number' && Number.isFinite(value)) {
    next.push(value);
  }
  return next.slice(-limit);
}

export function mapNumericSeries<T>(
  rows: T[] | null | undefined,
  selector: (row: T, index: number) => number | null | undefined,
  limit = 24,
): number[] {
  if (!rows?.length) {
    return [];
  }

  return rows
    .slice(-limit)
    .map(selector)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export function normalizeSeries(values: number[], low = 18, high = 86): number[] {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (cleanValues.length === 0) {
    return [];
  }

  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  if (min === max) {
    return cleanValues.map(() => (low + high) / 2);
  }

  return cleanValues.map((value) => low + ((value - min) / (max - min)) * (high - low));
}
