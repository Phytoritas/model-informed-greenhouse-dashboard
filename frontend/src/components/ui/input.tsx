import * as React from 'react';
import { cn } from '../../utils/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => (
    <input
        ref={ref}
        type={type}
        className={cn(
            'flex h-11 w-full rounded-[18px] border-0 bg-white/92 px-4 py-2 text-sm text-[color:var(--sg-text-strong)] shadow-[var(--sg-shadow-card)] placeholder:text-[color:var(--sg-text-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent-blue)]',
            className,
        )}
        {...props}
    />
));

Input.displayName = 'Input';

export { Input };
