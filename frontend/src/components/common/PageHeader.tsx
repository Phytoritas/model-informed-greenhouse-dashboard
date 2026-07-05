import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'grid gap-3 border-b border-[color:var(--sg-outline-soft)] pb-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end',
        className,
      )}
    >
      <div className="min-w-0 max-w-[680px]">
        {eyebrow ? <p className="sg-eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-1 text-[clamp(1.1rem,1rem+0.4vw,1.45rem)] font-bold leading-tight tracking-[-0.02em] text-[color:var(--sg-text-strong)]">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div> : null}
    </header>
  );
}
