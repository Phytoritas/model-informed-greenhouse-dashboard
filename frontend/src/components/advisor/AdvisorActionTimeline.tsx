import type { AdvisorActionEnvelope } from '../../hooks/useSmartGrowAdvisor';
import AdvisorActionCard from './AdvisorActionCard';
import AdvisorConfidenceBadge from './AdvisorConfidenceBadge';

interface AdvisorActionTimelineProps {
    title: string;
    subtitle?: string | null;
    actions?: AdvisorActionEnvelope;
    labels: {
        now: string;
        today: string;
        next3d: string;
        empty: string;
    };
}

const AdvisorActionTimeline = ({
    title,
    subtitle = null,
    actions,
    labels,
}: AdvisorActionTimelineProps) => {
    const buckets = [
        { key: 'now', label: labels.now, items: actions?.now ?? [] },
        { key: 'today', label: labels.today, items: actions?.today ?? [] },
        { key: 'next3d', label: labels.next3d, items: actions?.next_3d ?? [] },
    ] as const;

    return (
        <AdvisorActionCard title={title} subtitle={subtitle}>
            <div className="grid gap-4 xl:grid-cols-3">
                {buckets.map((bucket) => (
                    <div
                        key={bucket.key}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {bucket.label}
                        </div>
                        <div className="mt-3 space-y-3">
                            {bucket.items.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                                    {labels.empty}
                                </div>
                            ) : bucket.items.map((item, index) => (
                                <div
                                    key={`${bucket.key}-${item.title}-${index}`}
                                    className="rounded-2xl border border-slate-200 bg-white p-4"
                                >
                                    {item.badges?.length ? (
                                        <div className="flex flex-wrap gap-2">
                                            {item.badges.map((badge) => (
                                                <AdvisorConfidenceBadge
                                                    key={`${bucket.key}-${item.title}-${badge}`}
                                                    label={badge}
                                                    tone="neutral"
                                                />
                                            ))}
                                        </div>
                                    ) : null}
                                    <div className="mt-3 text-sm font-semibold text-slate-900">
                                        {item.title}
                                    </div>
                                    <div className="mt-2 text-sm leading-relaxed text-slate-600">
                                        {item.rationale}
                                    </div>
                                    {item.operator ? (
                                        <div className="mt-2 text-sm text-slate-600">
                                            {item.operator}
                                        </div>
                                    ) : null}
                                    {item.expected_effect ? (
                                        <div className="mt-2 text-sm text-slate-500">
                                            {item.expected_effect}
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </AdvisorActionCard>
    );
};

export default AdvisorActionTimeline;
