import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Separator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('h-px w-full bg-[color:var(--sg-outline-soft)]/50', className)} {...props} />;
}
