import AdvisorActionCard from './AdvisorActionCard';
import AdvisorConfidenceBadge from './AdvisorConfidenceBadge';

interface AdvisorLandedTabStatePanelProps {
    title: string;
    subtitle: string;
    notes: string[];
    status: 'idle' | 'loading' | 'success' | 'error';
    error: string | null;
    onRun: () => void;
}

const AdvisorLandedTabStatePanel = ({
    title,
    subtitle,
    notes,
    status,
    error,
    onRun,
}: AdvisorLandedTabStatePanelProps) => {
    const stateDescription = status === 'loading'
        ? 'The deterministic advisor is generating a fresh response from the current dashboard context.'
        : 'This advisor surface is already landed. Run it to inspect the latest deterministic guidance.';

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="space-y-4">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Landed Advisor
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <AdvisorConfidenceBadge label="landed" tone="success" />
                        <AdvisorConfidenceBadge label="deterministic" tone="info" />
                    </div>
                    <ul className="space-y-2 text-sm text-slate-600">
                        {notes.map((note) => (
                            <li key={note} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                {note}
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        onClick={onRun}
                        disabled={status === 'loading'}
                        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                    >
                        {status === 'loading' ? 'Running advisor...' : 'Run advisor'}
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                {status === 'error' ? (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                        Execution failed: {error}
                    </div>
                ) : (
                    <AdvisorActionCard
                        title="Execution state"
                        subtitle={stateDescription}
                        badges={status === 'loading' ? ['refreshing'] : ['ready']}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            <div>The tab is using the landed deterministic contract, not a pending placeholder.</div>
                            <div>Run the advisor again whenever the dashboard context changes.</div>
                        </div>
                    </AdvisorActionCard>
                )}
            </div>
        </div>
    );
};

export default AdvisorLandedTabStatePanel;
