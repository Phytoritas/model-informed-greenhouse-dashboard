import { useEffect, useEffectEvent, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface SheetProps {
    open?: boolean;
    children: ReactNode;
    onClose?: () => void;
    labelledBy?: string;
}

export function Sheet({ open = false, children, onClose, labelledBy }: SheetProps) {
    const surface = useRef<HTMLDivElement>(null);
    const close = useEffectEvent(() => onClose?.());
    useEffect(() => {
        if (!open) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const focusable = () => Array.from(surface.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
        ) ?? []).filter(element => element.getClientRects().length > 0);
        (focusable()[0] ?? surface.current)?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
            }
            if (event.key !== 'Tab') return;
            const items = focusable();
            const first = items[0];
            const last = items.at(-1);
            if (!first) {
                event.preventDefault();
                surface.current?.focus();
            } else if (event.shiftKey && (document.activeElement === first || document.activeElement === surface.current)) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [open]);
    if (!open) {
        return null;
    }
    return (
        <div
            ref={surface}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}
            className="fixed inset-0 z-50 flex justify-end bg-[rgba(16,45,59,0.32)] backdrop-blur-[3px]"
        >
            {children}
        </div>
    );
}

export function SheetContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('h-full w-full max-w-xl overflow-auto bg-[color:var(--sg-surface)] p-6 shadow-[var(--sg-shadow-soft)]', className)} {...props} />;
}
