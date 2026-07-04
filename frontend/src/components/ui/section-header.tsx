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
          ? 'flex flex-col gap-1 border-b border-[color:var(--sg-outline-soft)] pb-1 sm:flex-row sm:items-end sm:justify-between'
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
              ? 'mt-0.5 text-[clamp(0.82rem,0.78rem+0.2vw,0.96rem)] font-bold leading-tight text-[color:var(--sg-text-strong)]'
              : 'mt-2 text-[clamp(1.35rem,1rem+0.8vw,2rem)] font-bold leading-tight text-[color:var(--sg-text-strong)]',
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              compact
                ? 'mt-0.5 max-w-2xl text-[0.7rem] leading-4 text-[color:var(--sg-text-muted)]'
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
