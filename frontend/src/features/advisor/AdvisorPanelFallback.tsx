export default function AdvisorPanelFallback() {
    return (
        <div className="h-full animate-pulse rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-sm">
            <div className="h-5 w-28 rounded bg-white/20" />
            <div className="mt-4 rounded-lg bg-white/10 p-4">
                <div className="space-y-3">
                    <div className="h-3 rounded bg-white/20" />
                    <div className="h-3 w-11/12 rounded bg-white/20" />
                    <div className="h-3 w-3/4 rounded bg-white/20" />
                </div>
            </div>
        </div>
    );
}
