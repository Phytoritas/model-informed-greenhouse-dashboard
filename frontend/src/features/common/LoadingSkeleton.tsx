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
            className={`animate-pulse rounded-xl border border-slate-100 bg-white p-6 shadow-sm ${minHeightClassName} ${className}`.trim()}
        >
            <div className="h-5 w-40 rounded bg-slate-200" />
            <p className="mt-4 text-sm font-medium text-slate-500">{title}</p>
            <div className="mt-4 space-y-3">
                <div className="h-3 rounded bg-slate-100" />
                <div className="h-3 w-11/12 rounded bg-slate-100" />
                <div className="h-3 w-4/5 rounded bg-slate-100" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="h-24 rounded-lg bg-slate-100" />
                <div className="h-24 rounded-lg bg-slate-100" />
            </div>
            <p className="mt-4 text-xs text-slate-400">{loadingMessage}</p>
        </div>
    );
}
