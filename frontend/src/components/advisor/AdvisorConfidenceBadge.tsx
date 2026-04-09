interface AdvisorConfidenceBadgeProps {
    label: string;
    tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

const TONE_CLASSES: Record<NonNullable<AdvisorConfidenceBadgeProps['tone']>, string> = {
    neutral: 'bg-white/82 text-[color:var(--sg-text-muted)]',
    info: 'bg-[color:var(--sg-accent-blue-soft)] text-[color:var(--sg-accent-blue)]',
    success: 'bg-[color:var(--sg-accent-forest-soft)] text-[color:var(--sg-accent-success)]',
    warning: 'bg-[color:var(--sg-accent-amber-soft)] text-[color:var(--sg-accent-amber)]',
    danger: 'bg-rose-100 text-rose-700',
};

const AdvisorConfidenceBadge = ({
    label,
    tone = 'neutral',
}: AdvisorConfidenceBadgeProps) => (
    <span
        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}
        style={{ boxShadow: 'var(--sg-shadow-card)' }}
    >
        {label}
    </span>
);

export default AdvisorConfidenceBadge;
