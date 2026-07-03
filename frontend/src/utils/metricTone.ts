import type { KpiTileData } from '../components/KpiStrip';
import type { MetricTone } from '../components/ui/metric-card';

// Semantic Command tone for a KPI tile — availability state first, then health
// status. Shared by the Command overview metric deck (MetricCard) and the alerts
// LiveMetricStrip so both same-named surfaces converge on one tone mapping instead
// of sniffing raw Tailwind color names off `tile.color`.
export function metricToneForTile(tile: KpiTileData): MetricTone {
  if (tile.availabilityState === 'missing') {
    return 'muted';
  }
  if (tile.availabilityState === 'offline') {
    return 'critical';
  }
  if (tile.availabilityState === 'delayed' || tile.availabilityState === 'stale') {
    return 'warning';
  }
  return tile.healthStatus === 'critical'
    ? 'critical'
    : tile.healthStatus === 'warning'
      ? 'warning'
      : 'growth';
}

// Tone → surface-tint utility class, layered on top of `.sg-panel`. Matches the
// Command MetricCard treatment so the two same-named metric surfaces render the
// same tints.
export const metricToneSurfaceClass: Record<MetricTone, string> = {
  growth: 'bg-white',
  stable: 'bg-[color:var(--sg-color-sage-soft)]',
  warning: 'bg-[color:var(--sg-surface-warm)]',
  critical: 'bg-[color:var(--sg-color-primary-soft)]',
  muted: 'bg-[color:var(--sg-surface-muted)]',
};
