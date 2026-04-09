import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function HoverCard({ children }: { children: ReactNode }) {
    return <div className="group relative inline-flex">{children}</div>;
}

export function HoverCardTrigger({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export function HoverCardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('absolute left-0 top-full z-20 mt-2 hidden min-w-56 rounded-[20px] bg-white/96 p-4 shadow-[var(--sg-shadow-soft)] group-hover:block', className)} {...props} />;
}
