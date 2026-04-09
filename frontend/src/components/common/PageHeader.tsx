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
    <header className={cn('grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end', className)}>
      <div className="min-w-0 max-w-[680px]">
        {eyebrow ? <p className="sg-eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-2 text-[clamp(2rem,1.4rem+1.6vw,2.8rem)] font-semibold tracking-[-0.06em] text-[color:var(--sg-text-strong)]">
          {title}
        </h2>
        <p className="mt-2 text-[15px] leading-7 text-[color:var(--sg-text-muted)]">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div> : null}
    </header>
  );
}
