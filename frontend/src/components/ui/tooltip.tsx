import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function TooltipProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export function Tooltip({ children }: { children: ReactNode }) {
    return <div className="group relative inline-flex">{children}</div>;
}

export function TooltipTrigger({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export function TooltipContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 rounded-[14px] bg-[color:var(--sg-text-strong)] px-3 py-2 text-xs font-medium text-white shadow-[var(--sg-shadow-card)] group-hover:block',
                className,
            )}
            {...props}
        />
    );
}
