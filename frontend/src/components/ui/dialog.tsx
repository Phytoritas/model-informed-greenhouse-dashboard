import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface DialogProps {
    open?: boolean;
    children: ReactNode;
}

export function Dialog({ open = false, children }: DialogProps) {
    if (!open) {
        return null;
    }
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 p-4">{children}</div>;
}

export function DialogContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('w-full max-w-2xl rounded-[28px] bg-[color:var(--sg-surface)] p-6 shadow-[var(--sg-shadow-soft)]', className)} {...props} />;
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('mb-4 space-y-1', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
    return <h2 className={cn('text-xl font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
    return <p className={cn('text-sm leading-6 text-[color:var(--sg-text-muted)]', className)} {...props} />;
}
