import type { AppLocale } from '../i18n/locale';

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
