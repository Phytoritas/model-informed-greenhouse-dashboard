import * as React from 'react';
import { cn } from '../../utils/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => (
    <input
        ref={ref}
        type={type}
        className={cn(
            'flex h-11 w-full rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-4 py-2 text-sm text-[color:var(--sg-text-strong)] shadow-[var(--sg-shadow-card)] placeholder:text-[color:var(--sg-text-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--sg-bg)]',
            className,
        )}
        {...props}
    />
));

Input.displayName = 'Input';

export { Input };
