import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-[18px] bg-[linear-gradient(180deg,rgba(239,244,255,0.95),rgba(229,238,255,0.8))]', className)}
            {...props}
        />
    );
}
