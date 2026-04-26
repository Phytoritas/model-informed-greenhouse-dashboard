import type { HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const statusChipStyles = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none',
  {
    variants: {
      tone: {
        normal: 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]',
        growth: 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]',
        stable: 'bg-[color:var(--sg-status-stale-bg)] text-[color:var(--sg-status-stale-text)]',
        warning: 'bg-[color:var(--sg-status-delayed-bg)] text-[color:var(--sg-status-delayed-text)]',
        critical: 'bg-[color:var(--sg-status-offline-bg)] text-[color:var(--sg-status-offline-text)]',
        muted: 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]',
      },
    },
    defaultVariants: {
      tone: 'muted',
    },
  },
);

interface StatusChipProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusChipStyles> {
  icon?: ReactNode;
}

export function StatusChip({ className, tone, icon, children, ...props }: StatusChipProps) {
  return (
    <span className={cn(statusChipStyles({ tone }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}
