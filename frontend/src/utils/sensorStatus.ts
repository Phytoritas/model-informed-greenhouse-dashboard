import type { AppLocale } from '../i18n/locale';
import type { SensorFieldState, TelemetryStatus } from '../types';

export type SensorHealthStatus = 'normal' | 'warning' | 'critical';

export interface NumericRange {
  min: number;
  max: number;
}

/**
 * Derive health status from a sensor value and its ideal numeric range.
 * - Within [min, max]: normal
 * - Within 15% margin outside the range: warning
 * - Beyond 15% margin: critical
 */
export function deriveSensorStatus(
  value: number | null | undefined,
  range: NumericRange | undefined,
): SensorHealthStatus {
  if (value == null || !Number.isFinite(value) || !range) {
    return 'normal';
  }

  const span = range.max - range.min;
  const margin = span * 0.15;

  if (value >= range.min && value <= range.max) {
    return 'normal';
  }

  if (value >= range.min - margin && value <= range.max + margin) {
    return 'warning';
  }

  return 'critical';
}

/**
 * Build a one-line status summary from an array of health statuses.
 * Examples: "전체 정상", "주의 2건", "경고 1건 · 주의 1건"
 */
export function buildStatusSummary(
  statuses: SensorHealthStatus[],
  locale: AppLocale,
): string {
  const criticalCount = statuses.filter((s) => s === 'critical').length;
  const warningCount = statuses.filter((s) => s === 'warning').length;

  if (criticalCount === 0 && warningCount === 0) {
    return locale === 'ko' ? '전체 정상' : 'All normal';
  }

  const parts: string[] = [];

  if (criticalCount > 0) {
    parts.push(locale === 'ko' ? `경고 ${criticalCount}건` : `${criticalCount} critical`);
  }

  if (warningCount > 0) {
    parts.push(locale === 'ko' ? `주의 ${warningCount}건` : `${warningCount} warning`);
  }

  return parts.join(' · ');
}

export function deriveSensorFieldState(
  available: boolean,
  telemetryStatus: TelemetryStatus,
): SensorFieldState {
  if (telemetryStatus === 'offline') {
    return 'offline';
  }

  if (telemetryStatus === 'stale') {
    return 'stale';
  }

  if (telemetryStatus === 'delayed' || telemetryStatus === 'loading') {
    return available ? 'delayed' : 'missing';
  }

  if (!available) {
    return 'missing';
  }

  return 'live';
}

export function getSensorFieldStateLabel(
  state: SensorFieldState,
  locale: AppLocale,
): string {
  const labels: Record<SensorFieldState, Record<AppLocale, string>> = {
    live: { ko: '실시간', en: 'Live' },
    delayed: { ko: '지연', en: 'Delayed' },
    stale: { ko: '오래됨', en: 'Stale' },
    offline: { ko: '오프라인', en: 'Offline' },
    missing: { ko: '미수신', en: 'Missing' },
  };

  return labels[state][locale];
}

export function buildDataStateSummary(
  states: SensorFieldState[],
  locale: AppLocale,
): string {
  const counts = states.reduce<Record<SensorFieldState, number>>(
    (acc, state) => {
      acc[state] += 1;
      return acc;
    },
    {
      live: 0,
      delayed: 0,
      stale: 0,
      offline: 0,
      missing: 0,
    },
  );

  if (counts.offline > 0) {
    return locale === 'ko' ? '오프라인' : 'Offline';
  }

  if (counts.missing > 0) {
    return locale === 'ko' ? `미수신 ${counts.missing}개` : `${counts.missing} missing`;
  }

  if (counts.stale > 0) {
    return locale === 'ko' ? `오래됨 ${counts.stale}개` : `${counts.stale} stale`;
  }

  if (counts.delayed > 0) {
    return locale === 'ko' ? `지연 ${counts.delayed}개` : `${counts.delayed} delayed`;
  }

  return locale === 'ko' ? '실시간 수신' : 'Live telemetry';
}
