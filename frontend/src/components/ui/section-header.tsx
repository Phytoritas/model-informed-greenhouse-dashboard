import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  titleId?: string;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  titleId,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="sg-eyebrow">{eyebrow}</p> : null}
        <h2 id={titleId} className="mt-2 text-[clamp(1.35rem,1rem+0.8vw,2rem)] font-bold leading-tight text-[color:var(--sg-text-strong)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--sg-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
