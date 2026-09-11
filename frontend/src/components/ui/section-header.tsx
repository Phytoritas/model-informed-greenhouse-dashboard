import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  titleId?: string;
  density?: 'default' | 'compact';
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  titleId,
  density = 'default',
  className,
}: SectionHeaderProps) {
  const compact = density === 'compact';

  return (
    <div
      className={cn(
        compact
          ? 'flex flex-col gap-2 border-b border-[color:var(--sg-outline-soft)] pb-3 sm:flex-row sm:items-end sm:justify-between'
          : 'flex flex-col gap-3 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="sg-eyebrow">{eyebrow}</p> : null}
        <h2
          id={titleId}
          className={cn(
            compact
              ? 'mt-1 text-lg font-semibold leading-snug text-[color:var(--sg-text-strong)]'
              : 'mt-1 text-xl font-semibold leading-snug text-[color:var(--sg-text-strong)]',
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              compact
                ? 'mt-1 max-w-2xl text-[13px] leading-5 text-[color:var(--sg-text-muted)]'
                : 'mt-2 max-w-2xl text-sm leading-6 text-[color:var(--sg-text-muted)]',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
