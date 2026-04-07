interface AdvisorConfidenceBadgeProps {
    label: string;
    tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

const TONE_CLASSES: Record<NonNullable<AdvisorConfidenceBadgeProps['tone']>, string> = {
    neutral: 'border-slate-200 bg-slate-100 text-slate-600',
    info: 'border-sky-200 bg-sky-100 text-sky-700',
    success: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    warning: 'border-amber-200 bg-amber-100 text-amber-700',
    danger: 'border-rose-200 bg-rose-100 text-rose-700',
};

const AdvisorConfidenceBadge = ({
    label,
    tone = 'neutral',
}: AdvisorConfidenceBadgeProps) => (
    <span
        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE_CLASSES[tone]}`}
    >
        {label}
    </span>
);

export default AdvisorConfidenceBadge;
