import type { HTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function ToggleGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('inline-flex flex-wrap gap-2 rounded-[20px] bg-white/68 p-2 shadow-[var(--sg-shadow-card)]', className)} {...props} />;
}

interface ToggleGroupItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    pressed?: boolean;
}

export function ToggleGroupItem({ pressed = false, className, ...props }: ToggleGroupItemProps) {
    return (
        <button
            type="button"
            data-state={pressed ? 'on' : 'off'}
            className={cn(
                'rounded-[14px] px-3 py-2 text-sm font-semibold transition-colors',
                pressed
                    ? 'bg-[color:var(--sg-color-olive)] text-white shadow-[var(--sg-shadow-card)]'
                    : 'text-[color:var(--sg-text-muted)] hover:bg-white hover:text-[color:var(--sg-text-strong)]',
                className,
            )}
            {...props}
        />
    );
}
