import { describe, expect, it } from 'vitest';
import type { OverviewSourceSinkPoint } from '../types';
import {
  getLatestOverviewSourceSinkBalance,
  normalizeOverviewSourceSinkBalance,
} from './sourceSinkBalance';

describe('normalizeOverviewSourceSinkBalance', () => {
  it('uses source and sink fields when they are available', () => {
    const point: OverviewSourceSinkPoint = {
      time: '2026-04-11T09:00:00+09:00',
      source_sink_balance: 0.99,
      source_capacity: 12,
      sink_demand: 8,
    };

    expect(normalizeOverviewSourceSinkBalance(point)).toBeCloseTo(0.2, 6);
  });

  it('falls back to the raw balance when source and sink are missing', () => {
    const point: OverviewSourceSinkPoint = {
      time: '2026-04-11T09:00:00+09:00',
      source_sink_balance: -0.34,
      source_capacity: Number.NaN,
      sink_demand: Number.NaN,
    };

    expect(normalizeOverviewSourceSinkBalance(point)).toBeCloseTo(-0.34, 6);
  });
});

describe('getLatestOverviewSourceSinkBalance', () => {
  it('returns the most recent valid point regardless of input order', () => {
    const points: OverviewSourceSinkPoint[] = [
      {
        time: '2026-04-11T08:00:00+09:00',
        source_sink_balance: 0.1,
        source_capacity: 9,
        sink_demand: 7,
      },
      {
        time: '2026-04-11T10:00:00+09:00',
        source_sink_balance: 0.45,
        source_capacity: 15,
        sink_demand: 9,
      },
      {
        time: '2026-04-11T09:00:00+09:00',
        source_sink_balance: -0.1,
        source_capacity: 8,
        sink_demand: 10,
      },
    ];

    expect(getLatestOverviewSourceSinkBalance(points)).toBeCloseTo(0.25, 6);
  });

  it('returns null when there is no point history', () => {
    expect(getLatestOverviewSourceSinkBalance([])).toBeNull();
    expect(getLatestOverviewSourceSinkBalance(null)).toBeNull();
  });
});
