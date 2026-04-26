import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from './button';
import { StatusChip } from './status-chip';

type AlertTone = 'normal' | 'warning' | 'critical';

interface AlertCardProps {
  title: string;
  body: string;
  chip: string;
  actionLabel?: string;
  icon?: LucideIcon;
  tone?: AlertTone;
  onAction?: () => void;
  meta?: ReactNode;
  className?: string;
}

const toneClass: Record<AlertTone, string> = {
  normal: 'bg-white',
  warning: 'bg-[color:var(--sg-surface-warm)]',
  critical: 'bg-[color:var(--sg-color-primary-soft)]',
};

const bodyClampStyle: CSSProperties = {
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
};

export function AlertCard({
  title,
  body,
  chip,
  actionLabel,
  icon: Icon,
  tone = 'normal',
  onAction,
  meta,
  className,
}: AlertCardProps) {
  const actionVariant = tone === 'critical' ? 'secondary' : 'tonal';
  const actionClassName = tone === 'critical'
    ? 'h-6 border-[color:var(--sg-color-primary)] px-2 text-[0.64rem] text-[color:var(--sg-color-primary)]'
    : 'h-6 border border-[color:var(--sg-color-sage)] bg-white px-2 text-[0.64rem] text-[color:var(--sg-color-olive)] hover:bg-[color:var(--sg-color-sage-soft)]';

  return (
    <article className={cn('sg-panel flex h-full min-h-[76px] flex-col gap-0.5 p-1.5', toneClass[tone], className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--sg-radius-xs)] bg-white text-[color:var(--sg-text-strong)] shadow-[var(--sg-shadow-card)]">
              <Icon className="h-3 w-3" aria-hidden="true" />
            </span>
          ) : null}
          <h3 className="text-[0.74rem] font-bold leading-tight text-[color:var(--sg-text-strong)]">{title}</h3>
        </div>
      </div>
      <p className="flex-1 text-[0.63rem] leading-[0.9rem] text-[color:var(--sg-text-muted)]" style={bodyClampStyle}>{body}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <StatusChip tone={tone} className="px-2 py-0.5 text-[10px]">{chip}</StatusChip>
          {meta ? <div className="text-xs text-[color:var(--sg-text-muted)]">{meta}</div> : null}
        </div>
        {actionLabel ? (
          <Button variant={actionVariant} size="sm" className={actionClassName} onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
