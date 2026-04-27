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
        'grid gap-4 rounded-[28px] border border-[color:var(--sg-outline-soft)] bg-[linear-gradient(135deg,rgba(255,253,249,0.98),rgba(255,241,233,0.76)_56%,rgba(232,241,227,0.64))] px-5 py-5 shadow-[var(--sg-shadow-card)] md:grid-cols-[minmax(0,1fr)_auto] md:items-end',
        className,
      )}
    >
      <div className="min-w-0 max-w-[680px]">
        {eyebrow ? <p className="sg-eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-2 text-[clamp(1.75rem,1.35rem+1.2vw,2.55rem)] font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]">
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
