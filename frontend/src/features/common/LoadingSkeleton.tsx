interface LoadingSkeletonProps {
    title: string;
    loadingMessage: string;
    minHeightClassName?: string;
    className?: string;
}

export default function LoadingSkeleton({
    title,
    loadingMessage,
    minHeightClassName = 'min-h-[240px]',
    className = '',
}: LoadingSkeletonProps) {
    return (
        <div
            className={`animate-pulse rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-6 shadow-[var(--sg-shadow-card)] ${minHeightClassName} ${className}`.trim()}
        >
            <div className="h-5 w-40 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-color-blush)]" />
            <p className="mt-4 text-sm font-semibold text-[color:var(--sg-text-muted)]">{title}</p>
            <div className="mt-4 space-y-3">
                <div className="h-3 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)]" />
                <div className="h-3 w-11/12 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)]" />
                <div className="h-3 w-4/5 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)]" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="h-24 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-sage-soft)]" />
                <div className="h-24 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-warm)]" />
            </div>
            <p className="mt-4 text-xs text-[color:var(--sg-text-faint)]">{loadingMessage}</p>
        </div>
    );
}
