import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { cn } from '../../utils/cn';
import { metricToneSurfaceClass } from '../../utils/metricTone';
import DashboardCard from '../common/DashboardCard';
import ScientificText from '../common/ScientificText';
import { StatusChip } from './status-chip';

export type MetricTone = 'growth' | 'stable' | 'warning' | 'critical' | 'muted';
type MetricTrend = 'up' | 'down' | 'stable';

const trendIcon: Record<MetricTrend, ReactNode> = {
  up: <ArrowUp className="h-3 w-3" aria-hidden="true" />,
  down: <ArrowDown className="h-3 w-3" aria-hidden="true" />,
  stable: <ArrowRight className="h-3 w-3" aria-hidden="true" />,
};

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  trend?: MetricTrend;
  trendLabel?: string;
  icon?: LucideIcon;
  tone?: MetricTone;
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  detail,
  trend = 'stable',
  trendLabel,
  icon: Icon,
  tone = 'stable',
  className,
}: MetricCardProps) {
  // The dashboard supplies “change · 6h slope …”. Keep the complete change
  // visible and the longer slope context in the original tooltip/accessibility label.
  const visibleTrend = (trendLabel ?? 'Stable').split(/\s·\s(?=\d+h\s(?:기울기|slope))/i)[0];
  return (
    <DashboardCard
      variant="metric"
      className={cn('sg-panel flex h-full min-h-[48px] flex-col p-1.5', metricToneSurfaceClass[tone], className)}
      contentClassName="flex h-full flex-col"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-[color:var(--sg-text-muted)]" title={label}>
            <ScientificText text={label} />
          </div>
          {/* Units wrap rather than truncate: a clipped 'mol H₂O m⁻² s⁻¹' loses
              the physical dimension the reading depends on. */}
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
            <span className="sg-data-number text-[1rem] font-bold leading-none text-[color:var(--sg-text-strong)]">{value}</span>
            {unit ? (
              <ScientificText text={unit} className="scientific-unit min-w-0 text-xs text-[color:var(--sg-text-muted)]" />
            ) : null}
          </div>
        </div>
        {Icon ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]">
            <Icon className="h-3 w-3" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
        {/* The chip shows the change; the full string, units included, stays in
            the tooltip. The card's own unit line above keeps the dimension
            visible, so clipping here does not hide it. */}
        <StatusChip
          className="min-w-0 max-w-full whitespace-normal px-2 py-0.5 text-xs leading-4"
          tone={tone}
          icon={trendIcon[trend]}
          title={trendLabel ?? 'Stable'}
          aria-label={trendLabel ?? 'Stable'}
        >
          <ScientificText text={visibleTrend} />
        </StatusChip>
        {detail ? <span className="min-w-0 text-xs leading-5 text-[color:var(--sg-text-muted)]" title={detail}><ScientificText text={detail} /></span> : null}
      </div>
    </DashboardCard>
  );
}
