import { useLocale } from '../../i18n/LocaleProvider';
import { cn } from '../../utils/cn';

interface ConfidenceBadgeProps {
    value: number | null | undefined;
    className?: string;
}

export default function ConfidenceBadge({ value, className }: ConfidenceBadgeProps) {
    const { locale } = useLocale();
    const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : null;
    const percent = safeValue === null ? null : Math.round(safeValue * 100);
    const toneClassName =
        percent === null
            ? 'bg-slate-200 text-slate-700'
            : percent >= 80
                ? 'bg-emerald-100 text-emerald-900'
                : percent >= 65
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-rose-100 text-rose-900';
    const label =
        percent === null
            ? (locale === 'ko' ? '추가 확인 필요' : 'Needs review')
            : percent >= 80
                ? (locale === 'ko' ? '바로 적용 가능' : 'Ready')
                : percent >= 65
                    ? (locale === 'ko' ? '보수 적용' : 'Conservative')
                    : (locale === 'ko' ? '추가 확인' : 'Review first');

    return (
        <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.01em]', toneClassName, className)}>
            {locale === 'ko' ? '확인 상태' : 'Review state'} · {label}
        </span>
    );
}
