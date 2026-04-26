import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-wrap gap-2', className)} {...props} />;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-wrap items-center gap-2 rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] p-1.5 shadow-[var(--sg-shadow-card)]', className)} {...props} />;
}

export function TabsTrigger({
    className,
    'data-active': active,
    ...props
}: HTMLAttributes<HTMLButtonElement> & { 'data-active'?: boolean }) {
    return (
        <button
            type="button"
            data-active={active ? 'true' : undefined}
            className={cn(
                'rounded-[16px] px-4 py-2.5 text-sm font-semibold transition-colors',
                active
                    ? 'bg-[color:var(--sg-color-primary)] text-white shadow-[var(--sg-shadow-card)]'
                    : 'text-[color:var(--sg-text-muted)] hover:bg-[color:var(--sg-surface-raised)] hover:text-[color:var(--sg-text-strong)]',
                className,
            )}
            {...props}
        />
    );
}
