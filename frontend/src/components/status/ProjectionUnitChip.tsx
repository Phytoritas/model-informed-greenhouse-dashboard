import { useLocale } from '../../i18n/LocaleProvider';
import { cn } from '../../utils/cn';

interface ProjectionUnitChipProps {
    kind: 'canonical' | 'actual-area';
    className?: string;
}

export default function ProjectionUnitChip({ kind, className }: ProjectionUnitChipProps) {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            canonical: 'm 기준',
            actualArea: '실면적 총량 환산',
        }
        : {
            canonical: 'Per m²',
            actualArea: 'Actual-area total',
        };

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em]',
                kind === 'canonical'
                    ? 'bg-slate-200 text-slate-800'
                    : 'bg-emerald-100 text-emerald-900',
                className,
            )}
        >
            {kind === 'canonical' ? copy.canonical : copy.actualArea}
        </span>
    );
}
