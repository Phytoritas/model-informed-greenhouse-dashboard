import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-[18px] bg-[linear-gradient(180deg,rgba(255,253,249,0.96),rgba(255,231,225,0.66))]', className)}
            {...props}
        />
    );
}
