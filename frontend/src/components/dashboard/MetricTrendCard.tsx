import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { cn } from '../../utils/cn';
import { normalizeSeries } from '../../utils/metricTrendSeries';
import { StatusChip } from '../ui/status-chip';

type MetricTone = 'normal' | 'warning' | 'critical' | 'muted';
type MetricTrend = 'up' | 'down' | 'stable';
type ChartKind = 'bar' | 'line';

const toneClass: Record<MetricTone, string> = {
  normal: 'bg-white',
  warning: 'bg-[color:var(--sg-surface-warm)]',
  critical: 'bg-[color:var(--sg-color-primary-soft)]',
  muted: 'bg-[color:var(--sg-surface-muted)]',
};

const toneStroke: Record<MetricTone, string> = {
  normal: 'var(--sg-color-olive)',
  warning: 'var(--sg-accent-amber)',
  critical: 'var(--sg-color-primary)',
  muted: 'var(--sg-text-faint)',
};

const toneFill: Record<MetricTone, string> = {
  normal: 'var(--sg-color-sage)',
  warning: 'var(--sg-accent-amber)',
  critical: 'var(--sg-color-primary)',
  muted: 'var(--sg-surface-muted)',
};

const chipIcon = {
  up: <ArrowUp className="h-3 w-3" aria-hidden="true" />,
  down: <ArrowDown className="h-3 w-3" aria-hidden="true" />,
  stable: <ArrowRight className="h-3 w-3" aria-hidden="true" />,
} satisfies Record<MetricTrend, ReactNode>;

interface MetricTrendCardProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  trend?: MetricTrend;
  trendLabel?: string;
  icon?: LucideIcon;
  tone?: MetricTone;
  series?: number[];
  chartKind?: ChartKind;
  chartLabel?: string;
  emptyLabel?: string;
  className?: string;
}

function SparkChart({
  values,
  tone,
  kind,
  label,
  emptyLabel,
}: {
  values: number[];
  tone: MetricTone;
  kind: ChartKind;
  label: string;
  emptyLabel: string;
}) {
  const normalized = normalizeSeries(values, 18, 84);
  const hasGraph = normalized.length > 1;
  const width = 220;
  const height = 72;
  const step = normalized.length > 1 ? width / (normalized.length - 1) : width;
  const points = normalized.map((value, index) => `${index * step},${height - value}`).join(' ');
  const linePath = normalized.map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * step} ${height - value}`).join(' ');
  const areaPath = hasGraph ? `${linePath} L ${width} ${height} L 0 ${height} Z` : '';
  const barWidth = Math.max(7, Math.min(18, (width - 10) / Math.max(1, normalized.length) - 3));
  const stroke = toneStroke[tone];
  const fill = toneFill[tone];

  if (!hasGraph) {
    return (
      <div className="flex h-[76px] items-center justify-center rounded-[var(--sg-radius-sm)] border border-dashed border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)]/70 text-[0.68rem] font-semibold text-[color:var(--sg-text-faint)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      className="h-[76px] w-full overflow-visible rounded-[var(--sg-radius-sm)] bg-[linear-gradient(180deg,rgba(255,253,249,0.95),rgba(245,238,229,0.55))]"
      preserveAspectRatio="none"
    >
      <line x1="0" y1="54" x2={width} y2="54" stroke="rgba(123,93,78,0.12)" strokeWidth="1" />
      <line x1="0" y1="28" x2={width} y2="28" stroke="rgba(123,93,78,0.08)" strokeWidth="1" />
      {kind === 'bar' ? (
        normalized.map((value, index) => {
          const x = normalized.length === 1
            ? width / 2 - barWidth / 2
            : index * step - barWidth / 2;
          const y = Math.max(3, height - value);
          const barHeight = Math.max(5, height - y);
          return (
            <rect
              key={`${value}-${index}`}
              x={Math.max(2, Math.min(width - barWidth - 2, x))}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="5"
              fill={fill}
              opacity={index === normalized.length - 1 ? 0.95 : 0.58}
            />
          );
        })
      ) : (
        <>
          <path d={areaPath} fill={fill} opacity="0.13" />
          <polyline points={points} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={(normalized.length - 1) * step} cy={height - normalized[normalized.length - 1]} r="4" fill="var(--sg-color-primary)" />
        </>
      )}
    </svg>
  );
}

export default function MetricTrendCard({
  label,
  value,
  unit,
  detail,
  trend = 'stable',
  trendLabel,
  icon: Icon,
  tone = 'normal',
  series = [],
  chartKind = 'bar',
  chartLabel,
  emptyLabel = '추세 대기',
  className,
}: MetricTrendCardProps) {
  const chipTone = tone === 'critical'
    ? 'critical'
    : tone === 'warning'
      ? 'warning'
      : tone === 'muted'
        ? 'muted'
        : 'growth';

  return (
    <article className={cn('sg-panel min-h-[168px] p-2.5', toneClass[tone], className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[0.68rem] font-semibold text-[color:var(--sg-text-muted)]">{label}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="sg-data-number text-[1.24rem] font-bold leading-none text-[color:var(--sg-text-strong)]">{value}</span>
            {unit ? <span className="text-[0.68rem] font-semibold text-[color:var(--sg-text-muted)]">{unit}</span> : null}
          </div>
        </div>
        {Icon ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="mt-2">
        <SparkChart
          values={series}
          tone={tone}
          kind={chartKind}
          label={chartLabel ?? `${label} 추세 그래프`}
          emptyLabel={emptyLabel}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
        <StatusChip className="max-w-full px-2 py-0.5 text-[10px]" tone={chipTone} icon={chipIcon[trend]}>
          {trendLabel ?? '안정'}
        </StatusChip>
        {detail ? <span className="min-w-0 flex-1 truncate text-right text-[0.65rem] text-[color:var(--sg-text-muted)]">{detail}</span> : null}
      </div>
    </article>
  );
}
