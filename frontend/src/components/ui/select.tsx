import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={cn(
                'h-11 w-full rounded-[16px] border border-white/55 bg-white/88 px-3 text-sm font-medium text-[color:var(--sg-text-strong)] shadow-[var(--sg-shadow-card)] outline-none transition focus:border-[color:var(--sg-accent-forest)] focus:ring-2 focus:ring-[color:var(--sg-accent-forest)]/12',
                className,
            )}
            {...props}
        >
            {children}
        </select>
    );
}
