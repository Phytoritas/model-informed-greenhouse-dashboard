import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { cn } from '../../utils/cn';
import { StatusChip } from './status-chip';

type MetricTone = 'normal' | 'warning' | 'critical' | 'muted';
type MetricTrend = 'up' | 'down' | 'stable';

const toneClass: Record<MetricTone, string> = {
  normal: 'bg-white',
  warning: 'bg-[color:var(--sg-surface-warm)]',
  critical: 'bg-[color:var(--sg-color-primary-soft)]',
  muted: 'bg-[color:var(--sg-surface-muted)]',
};

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
  tone = 'normal',
  className,
}: MetricCardProps) {
  const chipTone = tone === 'critical'
    ? 'critical'
    : tone === 'warning'
      ? 'warning'
      : tone === 'muted'
        ? 'muted'
        : 'growth';

  return (
    <article className={cn('sg-panel min-h-[48px] p-1.5', toneClass[tone], className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[0.68rem] font-semibold text-[color:var(--sg-text-muted)]">{label}</div>
          <div className="mt-0.5 flex flex-nowrap items-baseline gap-1">
            <span className="sg-data-number text-[1rem] font-bold leading-none text-[color:var(--sg-text-strong)]">{value}</span>
            {unit ? <span className="min-w-0 truncate text-[0.65rem] font-semibold text-[color:var(--sg-text-muted)]">{unit}</span> : null}
          </div>
        </div>
        {Icon ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]">
            <Icon className="h-3 w-3" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex flex-nowrap items-center justify-between gap-1.5">
        <StatusChip className="min-w-0 max-w-[88px] overflow-hidden text-ellipsis whitespace-nowrap px-2 py-0.5 text-[10px]" tone={chipTone} icon={trendIcon[trend]}>
          {trendLabel ?? 'Stable'}
        </StatusChip>
        {detail ? <span className="min-w-0 truncate text-[0.65rem] text-[color:var(--sg-text-muted)]">{detail}</span> : null}
      </div>
    </article>
  );
}
