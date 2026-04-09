import { useLocale } from '../../i18n/LocaleProvider';
import { getReadinessDescriptor } from '../../lib/design/readiness';
import { cn } from '../../utils/cn';

interface ConfidenceBadgeProps {
    value: number | null | undefined;
    className?: string;
}

const TONE_CLASS_NAMES = {
    neutral: 'bg-slate-200 text-slate-700',
    info: 'bg-amber-100 text-amber-900',
    success: 'bg-emerald-100 text-emerald-900',
    warning: 'bg-rose-100 text-rose-900',
} as const;

export default function ConfidenceBadge({ value, className }: ConfidenceBadgeProps) {
    const { locale } = useLocale();
    const descriptor = getReadinessDescriptor(value, locale);

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.01em]',
                TONE_CLASS_NAMES[descriptor.tone],
                className,
            )}
        >
            {descriptor.lead} · {descriptor.label}
        </span>
    );
}
