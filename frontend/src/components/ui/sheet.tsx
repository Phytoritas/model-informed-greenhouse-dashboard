import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface SheetProps {
    open?: boolean;
    children: ReactNode;
}

export function Sheet({ open = false, children }: SheetProps) {
    if (!open) {
        return null;
    }
    return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/24">{children}</div>;
}

export function SheetContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('h-full w-full max-w-xl overflow-auto bg-[color:var(--sg-surface)] p-6 shadow-[var(--sg-shadow-soft)]', className)} {...props} />;
}
