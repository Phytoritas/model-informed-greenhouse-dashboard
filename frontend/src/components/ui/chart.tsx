import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function ChartFrame({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('rounded-[24px] bg-white/80 p-4 shadow-[var(--sg-shadow-card)]', className)}
            {...props}
        />
    );
}
