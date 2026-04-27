import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)} {...props} />;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('relative z-20 flex w-fit min-w-max items-center gap-1.5 rounded-full border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-1.5 shadow-[var(--sg-shadow-card)]', className)} {...props} />;
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
                'relative z-10 shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--sg-bg)]',
                active
                    ? 'bg-[color:var(--sg-color-primary)] text-white shadow-[var(--sg-shadow-card)]'
                    : 'text-[color:var(--sg-text-muted)] hover:bg-[color:var(--sg-surface-raised)] hover:text-[color:var(--sg-text-strong)]',
                className,
            )}
            {...props}
        />
    );
}
