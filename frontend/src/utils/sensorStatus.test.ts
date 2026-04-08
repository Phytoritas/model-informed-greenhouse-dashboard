import { describe, expect, it } from 'vitest';
import {
  buildDataStateSummary,
  buildStatusSummary,
  deriveSensorFieldState,
  deriveSensorStatus,
  getSensorFieldStateLabel,
} from './sensorStatus';

describe('sensorStatus', () => {
  it('distinguishes missing values from delayed or stale telemetry', () => {
    expect(
      deriveSensorFieldState(false, 'live'),
    ).toBe('missing');
    expect(
      deriveSensorFieldState(false, 'offline'),
    ).toBe('offline');
    expect(
      deriveSensorFieldState(true, 'delayed'),
    ).toBe('delayed');
    expect(
      deriveSensorFieldState(true, 'stale'),
    ).toBe('stale');
  });

  it('builds locale-aware summaries for data state and health', () => {
    expect(buildDataStateSummary(['live', 'missing', 'delayed'], 'ko')).toBe('미수신 1개');
    expect(buildStatusSummary(['critical', 'warning'], 'ko')).toBe('경고 1건 · 주의 1건');
    expect(getSensorFieldStateLabel('offline', 'en')).toBe('Offline');
  });

  it('keeps null values out of health alarms', () => {
    expect(deriveSensorStatus(null, { min: 18, max: 26 })).toBe('normal');
    expect(deriveSensorStatus(30, { min: 18, max: 26 })).toBe('critical');
  });
});
