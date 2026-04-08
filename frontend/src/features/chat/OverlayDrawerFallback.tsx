interface OverlayDrawerFallbackProps {
    title: string;
    closeLabel: string;
    loadingLabel: string;
    onClose: () => void;
    stacked?: boolean;
    variant?: 'chat' | 'rag';
}

export default function OverlayDrawerFallback({
    title,
    closeLabel,
    loadingLabel,
    onClose,
    stacked = false,
    variant = 'chat',
}: OverlayDrawerFallbackProps) {
    const sideClassName = stacked ? 'md:right-[26rem]' : 'md:right-6';
    const sizeClassName =
        variant === 'chat'
            ? 'h-[500px] w-96'
            : `h-[560px] md:w-[420px] ${sideClassName}`.trim();
    const positioningClassName =
        variant === 'chat'
            ? 'right-6'
            : `left-4 right-4 md:left-auto ${sideClassName}`.trim();

    return (
        <div
            className={`fixed bottom-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${sizeClassName} ${positioningClassName}`.trim()}
        >
            <div className="flex items-center justify-between bg-slate-900 p-4 text-white">
                <span className="font-medium">{title}</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-300 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                    {closeLabel}
                </button>
            </div>
            <div className="flex flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">
                {loadingLabel}
            </div>
        </div>
    );
}
