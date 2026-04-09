import { useLocale } from '../../i18n/LocaleProvider';
import { getReadinessDescriptor } from '../../lib/design/readiness';
import { cn } from '../../utils/cn';

interface ConfidenceBadgeProps {
    value: number | null | undefined;
    className?: string;
}

const TONE_CLASS_NAMES = {
    neutral: 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]',
    info: 'bg-[color:var(--sg-status-delayed-bg)] text-[color:var(--sg-status-delayed-text)]',
    success: 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]',
    warning: 'bg-[color:var(--sg-status-offline-bg)] text-[color:var(--sg-status-offline-text)]',
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
