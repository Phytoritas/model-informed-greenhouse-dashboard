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
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(49,35,24,0.24)] backdrop-blur-[2px]">
            {children}
        </div>
    );
}

export function SheetContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('h-full w-full max-w-xl overflow-auto bg-[color:var(--sg-surface)] p-6 shadow-[var(--sg-shadow-soft)]', className)} {...props} />;
}
