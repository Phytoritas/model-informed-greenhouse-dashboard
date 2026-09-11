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
            className={`animate-pulse rounded-xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-strong)] p-6 ${minHeightClassName} ${className}`.trim()}
        >
            <div className="h-5 w-40 rounded bg-[color:var(--sg-surface-deep)]" />
            <p className="mt-4 text-sm font-medium text-[color:var(--sg-text-muted)]">{title}</p>
            <div className="mt-4 space-y-3">
                <div className="h-3 rounded bg-[color:var(--sg-surface-deep)]" />
                <div className="h-3 w-11/12 rounded bg-[color:var(--sg-surface-deep)]" />
                <div className="h-3 w-4/5 rounded bg-[color:var(--sg-surface-deep)]" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="h-24 rounded-lg bg-[color:var(--sg-surface-deep)]" />
                <div className="h-24 rounded-lg bg-[color:var(--sg-surface-deep)]" />
            </div>
            <p className="mt-4 text-[13px] text-[color:var(--sg-text-faint)]">{loadingMessage}</p>
        </div>
    );
}
