import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { StatusChip } from './status-chip';

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendCardProps {
  title: string;
  value: string;
  support: string;
  data: TrendPoint[];
  unitLabel: string;
  trendLabel: string;
  icon?: LucideIcon;
  tone?: 'normal' | 'warning' | 'critical' | 'muted';
  className?: string;
}

function buildSparklinePath(data: TrendPoint[], width: number, height: number): string {
  if (data.length === 0) {
    return '';
  }
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return data
    .map((point, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function TrendCard({
  title,
  value,
  support,
  data,
  unitLabel,
  trendLabel,
  icon: Icon,
  tone = 'normal',
  className,
}: TrendCardProps) {
  const width = 180;
  const height = 54;
  const path = buildSparklinePath(data, width, height);
  const first = data[0]?.value;
  const last = data[data.length - 1]?.value;
  const deltaLabel = typeof first === 'number' && typeof last === 'number'
    ? `${last >= first ? '+' : ''}${(last - first).toFixed(1)} ${unitLabel}`
    : 'No trend data';

  return (
    <article className={cn('sg-panel flex h-full flex-col p-3.5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[color:var(--sg-text-muted)]">{title}</div>
          <div className="sg-data-number mt-2 text-[1.2rem] font-bold leading-none text-[color:var(--sg-text-strong)]">{value}</div>
        </div>
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)] shadow-[var(--sg-shadow-card)]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-[color:var(--sg-text-muted)]">{support}</p>
      <div className="mt-auto pt-3" aria-label={`${trendLabel}: ${deltaLabel}`}>
        {path ? (
          <svg viewBox={`0 0 ${width} ${height}`} role="img" className="h-[54px] w-full overflow-visible">
            <title>{trendLabel}</title>
            <path d={path} fill="none" stroke={tone === 'critical' ? 'var(--sg-color-primary)' : 'var(--sg-color-success)'} strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <div className="flex h-[54px] items-center text-xs text-[color:var(--sg-text-muted)]">No chart data</div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <StatusChip tone={tone} className="px-2 py-0.5 text-[10px]">{trendLabel}</StatusChip>
        <span className="text-xs font-semibold text-[color:var(--sg-text-muted)]">{deltaLabel}</span>
      </div>
    </article>
  );
}
