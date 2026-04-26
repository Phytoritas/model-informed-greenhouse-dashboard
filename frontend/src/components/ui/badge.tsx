import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const badgeVariants = cva(
    'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-[var(--sg-shadow-card)]',
    {
        variants: {
            variant: {
                default: 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-text-strong)]',
                forest: 'bg-[color:var(--sg-accent-forest-soft)] text-[color:var(--sg-accent-forest)]',
                blue: 'bg-[color:var(--sg-accent-blue-soft)] text-[color:var(--sg-accent-blue)]',
                amber: 'bg-[color:var(--sg-accent-amber-soft)] text-[color:var(--sg-accent-amber)]',
                violet: 'bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary-strong)]',
                danger: 'bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary-strong)]',
                muted: 'bg-[color:var(--sg-surface-muted)] text-[color:var(--sg-text-muted)]',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

interface BadgeProps
    extends HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
