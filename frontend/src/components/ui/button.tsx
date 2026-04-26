import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonStyles = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--sg-radius-sm)] text-sm font-semibold transition-colors transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--sg-bg)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 active:translate-y-[1px]',
    {
        variants: {
            variant: {
                default: 'bg-[color:var(--sg-color-primary)] text-white shadow-[var(--sg-shadow-card)] hover:bg-[color:var(--sg-color-primary-strong)]',
                primary: 'bg-[color:var(--sg-color-primary)] text-white shadow-[var(--sg-shadow-card)] hover:bg-[color:var(--sg-color-primary-strong)]',
                secondary: 'border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-color-primary)] shadow-[var(--sg-shadow-card)] hover:bg-[color:var(--sg-color-primary-soft)]',
                ghost: 'bg-transparent text-[color:var(--sg-text-muted)] hover:bg-white/70 hover:text-[color:var(--sg-text-strong)]',
                tonal: 'bg-[color:var(--sg-color-olive-soft)] text-[color:var(--sg-color-olive)] shadow-[var(--sg-shadow-card)] hover:bg-[#e2ecd8]',
                danger: 'bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary-strong)] shadow-[var(--sg-shadow-card)] hover:bg-[#facfcc]',
                disabled: 'bg-[#e5e7eb] text-[#98a2b3] shadow-none',
            },
            size: {
                default: 'h-11 px-4 py-2.5',
                sm: 'h-9 rounded-[var(--sg-radius-xs)] px-3 py-2 text-xs',
                lg: 'h-12 rounded-[var(--sg-radius-sm)] px-5 py-3',
                icon: 'h-11 w-11 rounded-[var(--sg-radius-sm)]',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonStyles> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, type = 'button', ...props }, ref) => (
        <button
            ref={ref}
            type={type}
            className={cn(buttonStyles({ variant, size }), className)}
            {...props}
        />
    ),
);

Button.displayName = 'Button';

export { Button };
