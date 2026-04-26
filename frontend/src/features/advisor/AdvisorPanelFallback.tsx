export default function AdvisorPanelFallback() {
    return (
        <div className="h-full animate-pulse rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-6 shadow-[var(--sg-shadow-card)]">
            <div className="h-5 w-28 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-color-blush)]" />
            <div className="mt-4 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-warm)] p-4">
                <div className="space-y-3">
                    <div className="h-3 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)]" />
                    <div className="h-3 w-11/12 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)]" />
                    <div className="h-3 w-3/4 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)]" />
                </div>
            </div>
        </div>
    );
}
