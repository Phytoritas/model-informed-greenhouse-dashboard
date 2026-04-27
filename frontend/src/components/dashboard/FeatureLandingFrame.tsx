import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, BarChart3 } from 'lucide-react';
import greenhouseHero from '../../assets/overview-greenhouse-hero.jpg';
import { cn } from '../../utils/cn';
import { AlertCard } from '../ui/alert-card';
import { Button } from '../ui/button';
import { MetricCard } from '../ui/metric-card';
import { StatusChip } from '../ui/status-chip';
import { FinalCTA, LandingFooter, TopNavigation } from './overviewLandingSections';

type MetricTone = 'normal' | 'warning' | 'critical' | 'muted';
type StatusTone = 'normal' | 'growth' | 'stable' | 'warning' | 'critical' | 'muted';
type Trend = 'up' | 'down' | 'stable';

export interface FeatureMetric {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  trend?: Trend;
  trendLabel?: string;
  icon?: LucideIcon;
  tone?: MetricTone;
}

export interface FeatureActionCard {
  title: string;
  body: string;
  chip: string;
  icon?: LucideIcon;
  tone?: 'normal' | 'warning' | 'critical';
  actionLabel?: string;
  to?: string;
  href?: string;
  onAction?: () => void;
  meta?: ReactNode;
}

export interface FeatureComparisonColumn {
  title: string;
  subtitle: string;
  rows: Array<[string, string]>;
  badgeLabel: string;
  badgeCaption?: string;
  emphasized?: boolean;
}

export interface FeatureBridgeCard {
  title: string;
  value: string;
  body: string;
  chip: string;
  chipTone?: StatusTone;
  icon: LucideIcon;
  rows?: Array<[string, string]>;
  actionLabel?: string;
  to?: string;
  href?: string;
  onAction?: () => void;
}

export interface FeatureHeroAction {
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export interface FeaturePreviewMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface FeaturePreview {
  eyebrow: string;
  title: string;
  statusLabel: string;
  statusTone?: StatusTone;
  metrics: FeaturePreviewMetric[];
  chartLabel: string;
  chartStatus: string;
  chartValues?: number[];
}

interface FeatureLandingFrameProps {
  title: string;
  description: string;
  heroBadge: string;
  heroTitle: string;
  heroBody: string;
  primaryAction: FeatureHeroAction;
  secondaryAction: FeatureHeroAction;
  preview: FeaturePreview;
  metricsEyebrow: string;
  metricsFreshness: string;
  metrics: FeatureMetric[];
  actionsEyebrow: string;
  actionsTitle: string;
  actions: FeatureActionCard[];
  comparisonEyebrow: string;
  comparisonTitle: string;
  comparisonStatusLabel: string;
  comparisonStatusTone?: StatusTone;
  comparisonNote?: string;
  baseline: FeatureComparisonColumn;
  optimized: FeatureComparisonColumn;
  bridgeEyebrow: string;
  bridgeTitle: string;
  bridgeCards: FeatureBridgeCard[];
  detailEyebrow: string;
  detailTitle: string;
  detailDescription?: string;
  children: ReactNode;
  onOpenAssistant: () => void;
}

function normalizeValues(values: number[] | undefined): number[] {
  const cleanValues = (values ?? []).filter((value) => Number.isFinite(value));
  if (cleanValues.length === 0) {
    return [46, 68, 55, 74, 62, 80, 71];
  }

  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  if (min === max) {
    return cleanValues.map(() => 62);
  }

  return cleanValues.map((value) => 28 + ((value - min) / (max - min)) * 54);
}

function HeroAction({ action }: { action: FeatureHeroAction }) {
  const baseClass = action.variant === 'secondary'
    ? 'inline-flex h-8 items-center justify-center rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-color-primary)] bg-white px-3.5 text-xs font-bold text-[color:var(--sg-color-primary)] shadow-[var(--sg-shadow-card)] hover:bg-[color:var(--sg-color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2'
    : 'inline-flex h-8 items-center justify-center rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary)] px-3.5 text-xs font-bold text-white shadow-[var(--sg-shadow-card)] hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2';

  if (action.onClick) {
    return (
      <button type="button" className={baseClass} onClick={action.onClick}>
        {action.label}
      </button>
    );
  }

  if (action.href) {
    return (
      <a className={baseClass} href={action.href}>
        {action.label}
      </a>
    );
  }

  return (
    <Link className={baseClass} to={action.to ?? '/overview'}>
      {action.label}
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  titleId,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  titleId: string;
  actions?: ReactNode;
}) {
  return (
    <div className="overview-section-heading">
      <div className="min-w-0">
        <p className="sg-eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        {description ? <p className="mt-0.5 max-w-3xl text-[0.7rem] leading-4 text-[color:var(--sg-text-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

function DashboardPreview({ preview }: { preview: FeaturePreview }) {
  const chartBars = normalizeValues(preview.chartValues).slice(-8);

  return (
    <article className="overview-dashboard-preview">
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--sg-outline-soft)] px-3 py-2">
        <div className="min-w-0">
          <p className="sg-eyebrow">{preview.eyebrow}</p>
          <h2 className="mt-0.5 text-[0.82rem] font-bold leading-tight text-[color:var(--sg-text-strong)]">{preview.title}</h2>
        </div>
        <StatusChip tone={preview.statusTone ?? 'growth'} className="shrink-0 px-2 py-0.5 text-[10px]">
          {preview.statusLabel}
        </StatusChip>
      </div>
      <div className="space-y-2 px-3 py-2">
        <div className="overview-dashboard-mini-grid">
          {preview.metrics.slice(0, 3).map((metric) => (
            <div key={metric.label} className="overview-preview-metric">
              <div className="truncate text-[10px] font-semibold text-[color:var(--sg-text-faint)]">{metric.label}</div>
              <div className="sg-data-number mt-0.5 text-[0.76rem] font-bold leading-none text-[color:var(--sg-text-strong)]">{metric.value}</div>
              {metric.detail ? <div className="mt-0.5 truncate text-[10px] text-[color:var(--sg-text-muted)]">{metric.detail}</div> : null}
            </div>
          ))}
        </div>
        <div className="rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white/70 p-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.68rem] font-bold text-[color:var(--sg-text-strong)]">{preview.chartLabel}</div>
            <div className="text-[10px] font-semibold text-[color:var(--sg-color-olive)]">{preview.chartStatus}</div>
          </div>
          <div className="mt-2 flex h-[42px] items-end gap-1" aria-hidden="true">
            {chartBars.map((height, index) => (
              <span
                key={`${height}-${index}`}
                className={cn(
                  'block flex-1 rounded-t-[5px]',
                  index === chartBars.length - 1 ? 'bg-[color:var(--sg-color-primary)]' : 'bg-[color:var(--sg-color-sage)]',
                )}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="sr-only">{preview.chartLabel}: {preview.chartStatus}</div>
        </div>
      </div>
    </article>
  );
}

function ComparisonCard({ column }: { column: FeatureComparisonColumn }) {
  return (
    <article className={cn('rounded-[var(--sg-radius-sm)] border p-[0.42rem]', column.emphasized ? 'border-[color:var(--sg-color-sage)] bg-[color:var(--sg-color-sage-soft)]' : 'border-[color:var(--sg-outline-soft)] bg-white')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.74rem] font-bold leading-tight text-[color:var(--sg-text-strong)]">{column.title}</h3>
          <p className="mt-0.5 text-[0.62rem] text-[color:var(--sg-text-muted)]">{column.subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          {column.badgeCaption ? <div className="text-[10px] font-semibold uppercase text-[color:var(--sg-text-faint)]">{column.badgeCaption}</div> : null}
          <div className="sg-data-number text-[0.72rem] font-bold text-[color:var(--sg-color-success)]">{column.badgeLabel}</div>
        </div>
      </div>
      <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 md:grid-cols-4">
        {column.rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold text-[color:var(--sg-text-faint)]">{label}</dt>
            <dd className="sg-data-number mt-0.5 text-[0.66rem] font-bold text-[color:var(--sg-text-strong)]">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function BridgeCard({ card }: { card: FeatureBridgeCard }) {
  const navigate = useNavigate();
  const Icon = card.icon;
  const handleAction = card.onAction
    ?? (card.to ? () => navigate(card.to as string) : undefined)
    ?? (card.href ? () => { window.location.href = card.href as string; } : undefined);

  return (
    <article className="sg-panel flex h-full min-h-[92px] flex-col gap-1 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.7rem] font-bold text-[color:var(--sg-text-strong)]">{card.title}</div>
          <div className="sg-data-number mt-0.5 text-[0.9rem] font-bold leading-none text-[color:var(--sg-text-strong)]">{card.value}</div>
        </div>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)] shadow-[var(--sg-shadow-card)]">
          <Icon className="h-3 w-3" aria-hidden="true" />
        </span>
      </div>
      <p className="text-[0.64rem] leading-[0.9rem] text-[color:var(--sg-text-muted)]">{card.body}</p>
      {card.rows?.length ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-[color:var(--sg-outline-soft)] pt-1">
          {card.rows.slice(0, 2).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] font-semibold text-[color:var(--sg-text-faint)]">{label}</dt>
              <dd className="sg-data-number mt-0.5 text-[0.66rem] font-bold text-[color:var(--sg-text-strong)]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <StatusChip tone={card.chipTone ?? 'growth'}>{card.chip}</StatusChip>
        {card.actionLabel && handleAction ? <Button variant="secondary" size="sm" onClick={handleAction}>{card.actionLabel}</Button> : null}
      </div>
    </article>
  );
}

export default function FeatureLandingFrame({
  title,
  description,
  heroBadge,
  heroTitle,
  heroBody,
  primaryAction,
  secondaryAction,
  preview,
  metricsEyebrow,
  metricsFreshness,
  metrics,
  actionsEyebrow,
  actionsTitle,
  actions,
  comparisonEyebrow,
  comparisonTitle,
  comparisonStatusLabel,
  comparisonStatusTone = 'stable',
  comparisonNote,
  baseline,
  optimized,
  bridgeEyebrow,
  bridgeTitle,
  bridgeCards,
  detailEyebrow,
  detailTitle,
  detailDescription,
  children,
  onOpenAssistant,
}: FeatureLandingFrameProps) {
  const navigate = useNavigate();
  const resolvedActions = actions.slice(0, 4);
  const resolvedBridgeCards = bridgeCards.slice(0, 3);

  return (
    <main className="overview-browser-shell" aria-label={title}>
      <div className="overview-browser-frame">
        <div className="overview-frame-body">
          <TopNavigation onOpenAssistant={onOpenAssistant} />
          <section className="overview-hero scroll-mt-24" aria-labelledby="feature-route-hero-title">
            <div className="overview-hero-copy">
              <StatusChip tone="growth" className="w-fit">{heroBadge}</StatusChip>
              <h1 id="feature-route-hero-title" className="mt-1.5 max-w-[13ch] text-[clamp(1.42rem,2vw,1.88rem)] font-bold leading-[1.04] text-[color:var(--sg-text-strong)]">
                {heroTitle}
              </h1>
              <p className="mt-1.5 max-w-xl text-[0.76rem] leading-5 text-[color:var(--sg-text-muted)]">
                {heroBody}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                <HeroAction action={{ ...primaryAction, variant: 'primary' }} />
                <HeroAction action={{ ...secondaryAction, variant: 'secondary' }} />
              </div>
            </div>
            <div className="overview-hero-visual">
              <img src={greenhouseHero} alt="" className="overview-greenhouse-backdrop" aria-hidden="true" />
              <div className="relative z-[2] flex h-full items-center justify-end">
                <DashboardPreview preview={preview} />
              </div>
            </div>
          </section>

          <section className="scroll-mt-24 space-y-1.5" aria-label={metricsEyebrow}>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="sg-eyebrow">{metricsEyebrow}</h2>
              <span className="text-xs font-semibold text-[color:var(--sg-text-muted)]">{metricsFreshness}</span>
            </div>
            <div className="overview-metric-row">
              {metrics.slice(0, 7).map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>
          </section>

          <section className="scroll-mt-24 space-y-1.5" aria-labelledby="feature-route-actions-title">
            <SectionHeading titleId="feature-route-actions-title" eyebrow={actionsEyebrow} title={actionsTitle} />
            <div className="overview-card-row-4">
              {resolvedActions.map((action) => {
                const handleAction = action.onAction
                  ?? (action.to ? () => navigate(action.to as string) : undefined)
                  ?? (action.href ? () => { window.location.href = action.href as string; } : undefined);
                return (
                  <AlertCard
                    key={action.title}
                    title={action.title}
                    body={action.body}
                    chip={action.chip}
                    tone={action.tone ?? 'normal'}
                    icon={action.icon}
                    actionLabel={action.actionLabel}
                    onAction={handleAction}
                    meta={action.meta}
                  />
                );
              })}
            </div>
          </section>

          <section className="scroll-mt-24 space-y-0.5" aria-labelledby="feature-route-comparison-title">
            <SectionHeading
              titleId="feature-route-comparison-title"
              eyebrow={comparisonEyebrow}
              title={comparisonTitle}
              actions={(
                <div className="flex items-center gap-2">
                  <StatusChip tone={comparisonStatusTone}>{comparisonStatusLabel}</StatusChip>
                  {comparisonNote ? <span className="hidden text-xs font-semibold text-[color:var(--sg-text-muted)] sm:inline">{comparisonNote}</span> : null}
                </div>
              )}
            />
            <div className="sg-panel p-1">
              <div className="grid gap-1 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <ComparisonCard column={baseline} />
                <div className="hidden h-7 w-7 items-center justify-center rounded-full border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-color-primary)] shadow-[var(--sg-shadow-card)] md:flex">
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <ComparisonCard column={{ ...optimized, emphasized: true }} />
              </div>
            </div>
          </section>

          <section className="scroll-mt-24 space-y-1" aria-labelledby="feature-route-bridge-title">
            <SectionHeading titleId="feature-route-bridge-title" eyebrow={bridgeEyebrow} title={bridgeTitle} />
            <div className="overview-card-row-3">
              {resolvedBridgeCards.map((card) => <BridgeCard key={card.title} card={card} />)}
            </div>
          </section>

          <section className="sg-panel bg-[color:var(--sg-surface-raised)] p-3" aria-labelledby="feature-route-detail-title">
            <SectionHeading
              titleId="feature-route-detail-title"
              eyebrow={detailEyebrow}
              title={detailTitle}
              description={detailDescription ?? description}
              actions={<BarChart3 className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />}
            />
            <div className="mt-3 min-w-0 space-y-5">
              {children}
            </div>
          </section>

          <FinalCTA />
          <LandingFooter onOpenAssistant={onOpenAssistant} />
        </div>
      </div>
    </main>
  );
}
