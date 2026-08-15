import { expect, test } from 'vitest';
import type { SensorData } from '../types';
import { buildAdaptiveHistoryPayload } from './adaptiveHistory';

function point(timestamp: number, photosynthesis: number): SensorData {
  return {
    timestamp,
    temperature: 24,
    canopyTemp: 24.5,
    humidity: 72,
    co2: 700,
    light: 500,
    soilMoisture: 0.6,
    vpd: 0.9,
    transpiration: 0.15,
    stomatalConductance: 0.3,
    photosynthesis,
    hFlux: 50,
    leFlux: 120,
    energyUsage: 10,
  };
}

test('preserves recent and same-time previous-day windows within a bounded payload', () => {
  const hour = 60 * 60 * 1000;
  const reference = Date.UTC(2026, 7, 15, 9, 0, 0);
  const history: SensorData[] = [];

  for (let offset = -30; offset <= 0; offset += 0.25) {
    history.push(point(reference + offset * hour, 18 + offset / 30));
  }

  const current = point(reference, 14);
  const result = buildAdaptiveHistoryPayload(current, history, 80);
  const timestamps = result.map((item) => item.timestamp);

  expect(result.length).toBeLessThanOrEqual(80);
  expect(timestamps).toContain(reference);
  expect(
    timestamps.some((timestamp) => Math.abs(timestamp - (reference - 24 * hour)) <= 15 * 60 * 1000),
  ).toBe(true);
  expect(
    timestamps.some((timestamp) => timestamp >= reference - 2 * hour),
  ).toBe(true);
});

test('deduplicates timestamps and orders the bounded history', () => {
  const reference = Date.UTC(2026, 7, 15, 9, 0, 0);
  const duplicate = point(reference, 10);
  const current = point(reference, 14);
  const result = buildAdaptiveHistoryPayload(current, [duplicate, duplicate], 20);

  expect(result).toHaveLength(1);
  expect(result[0].photosynthesis).toBe(14);
});
