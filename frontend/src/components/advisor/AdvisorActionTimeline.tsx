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
        { key: 'now', label: labels.now, items: actions?.now ?? [], tone: 'sg-tint-green' },
        { key: 'today', label: labels.today, items: actions?.today ?? [], tone: 'sg-tint-blue' },
        { key: 'next3d', label: labels.next3d, items: actions?.next_3d ?? [], tone: 'sg-tint-violet' },
    ] as const;
    const leadBucket = buckets[0];
    const supportingBuckets = buckets.slice(1);

    function renderBucket(
        bucket: typeof buckets[number],
        prominent = false,
    ) {
        const leadItem = bucket.items[0] ?? null;
        const supportingItems = leadItem ? bucket.items.slice(1) : [];

        return (
            <div
                key={bucket.key}
                className={`rounded-[28px] p-4 ${bucket.tone} ${prominent ? 'min-h-[16rem]' : ''}`}
                style={{ boxShadow: prominent ? 'var(--sg-shadow-soft)' : 'var(--sg-shadow-card)' }}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                        {bucket.label}
                    </div>
                    <div
                        className="rounded-full bg-white/88 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--sg-text-muted)]"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        {bucket.items.length}
                    </div>
                </div>

                <div className="mt-3 space-y-3">
                    {leadItem ? (
                        <div
                            className={`rounded-[24px] bg-white/88 p-4 ${prominent ? 'min-h-[9.5rem]' : ''}`}
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            {leadItem.badges?.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {leadItem.badges.map((badge) => (
                                        <AdvisorConfidenceBadge
                                            key={`${bucket.key}-${leadItem.title}-${badge}`}
                                            label={badge}
                                            tone="neutral"
                                        />
                                    ))}
                                </div>
                            ) : null}
                            <div className="mt-3 flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--sg-accent-forest-soft)] text-xs font-semibold text-[color:var(--sg-accent-forest)]">
                                    {bucket.key === 'now' ? '01' : bucket.key === 'today' ? '02' : '03'}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                        {leadItem.title}
                                    </div>
                                    <div className="mt-2 text-sm leading-7 text-[color:var(--sg-text-muted)]">
                                        {leadItem.rationale}
                                    </div>
                                    {leadItem.operator ? (
                                        <div className="mt-2 text-sm text-[color:var(--sg-text-muted)]">
                                            {leadItem.operator}
                                        </div>
                                    ) : null}
                                    {leadItem.expected_effect ? (
                                        <div className="mt-2 text-sm text-[color:var(--sg-text-faint)]">
                                            {leadItem.expected_effect}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="rounded-[22px] bg-white/84 px-3 py-3 text-sm text-[color:var(--sg-text-muted)]"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            {labels.empty}
                        </div>
                    )}

                    {supportingItems.length > 0 ? (
                        <div className="space-y-2">
                            {supportingItems.map((item, index) => (
                                <div
                                    key={`${bucket.key}-${item.title}-${index}`}
                                    className="rounded-[20px] bg-white/78 px-4 py-3"
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                        {item.title}
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                                        {item.rationale}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <AdvisorActionCard title={title} subtitle={subtitle} tone="neutral">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
                {renderBucket(leadBucket, true)}
                <div className="space-y-4">
                    {supportingBuckets.map((bucket) => renderBucket(bucket))}
                </div>
            </div>
        </AdvisorActionCard>
    );
};

export default AdvisorActionTimeline;
