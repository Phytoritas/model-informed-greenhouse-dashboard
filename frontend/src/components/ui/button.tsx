import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonStyles = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[18px] text-sm font-semibold transition-colors transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent-violet)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-[1px]',
    {
        variants: {
            variant: {
                default: 'bg-[linear-gradient(135deg,var(--sg-accent-violet),#d14a4c)] text-white shadow-[var(--sg-shadow-card)] hover:brightness-95',
                secondary: 'bg-[color:var(--sg-accent-forest-soft)] text-[color:var(--sg-accent-forest)] shadow-[var(--sg-shadow-card)] hover:bg-[#d3e5dc]',
                ghost: 'bg-transparent text-[color:var(--sg-text-muted)] hover:bg-white/70 hover:text-[color:var(--sg-text-strong)]',
                tonal: 'bg-[color:var(--sg-accent-earth-soft)] text-[color:var(--sg-accent-earth)] shadow-[var(--sg-shadow-card)] hover:bg-[#ead8ca]',
                danger: 'bg-[color:var(--sg-accent-rose-soft)] text-[color:var(--sg-accent-rose)] shadow-[var(--sg-shadow-card)] hover:bg-[#f1c8cd]',
            },
            size: {
                default: 'h-11 px-4 py-2.5',
                sm: 'h-9 rounded-[14px] px-3 py-2 text-xs',
                lg: 'h-12 rounded-[20px] px-5 py-3',
                icon: 'h-11 w-11 rounded-[18px]',
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
