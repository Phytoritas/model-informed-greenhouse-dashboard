import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked?: boolean;
}

export function Switch({ checked = false, className, ...props }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            data-state={checked ? 'checked' : 'unchecked'}
            className={cn(
                'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
                checked ? 'bg-[color:var(--sg-accent-forest)]' : 'bg-[color:var(--sg-surface-muted)]',
                className,
            )}
            {...props}
        >
            <span
                className={cn(
                    'inline-block h-5 w-5 rounded-full bg-white shadow-[var(--sg-shadow-card)] transition-transform',
                    checked ? 'translate-x-6' : 'translate-x-1',
                )}
            />
        </button>
    );
}
