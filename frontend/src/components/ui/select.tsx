import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={cn(
                'h-11 w-full rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-3 text-sm font-medium text-[color:var(--sg-text-strong)] shadow-[var(--sg-shadow-card)] outline-none transition focus:border-[color:var(--sg-color-primary)] focus:ring-2 focus:ring-[color:var(--sg-color-primary)]/20',
                className,
            )}
            {...props}
        >
            {children}
        </select>
    );
}
