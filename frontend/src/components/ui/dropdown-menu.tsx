import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function DropdownMenu({ children }: { children: ReactNode }) {
    return <div className="group relative inline-flex">{children}</div>;
}

export function DropdownMenuTrigger({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export function DropdownMenuContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('absolute right-0 top-full z-20 mt-2 hidden min-w-44 rounded-[18px] bg-white/96 p-2 shadow-[var(--sg-shadow-soft)] group-hover:block', className)} {...props} />;
}

export function DropdownMenuItem({ className, ...props }: HTMLAttributes<HTMLButtonElement>) {
    return <button type="button" className={cn('flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm font-medium text-[color:var(--sg-text-strong)] hover:bg-[color:var(--sg-surface-muted)]', className)} {...props} />;
}
