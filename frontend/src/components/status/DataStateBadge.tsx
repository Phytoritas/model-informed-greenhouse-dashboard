import type { SensorFieldState } from '../../types';
import { useLocale } from '../../i18n/LocaleProvider';
import { cn } from '../../utils/cn';

type ExtendedDataState = SensorFieldState | 'unavailable' | 'blocked' | 'provisional' | 'loading';

interface DataStateBadgeProps {
    state: ExtendedDataState;
    label?: string;
    className?: string;
}

const BADGE_CLASSNAME: Record<ExtendedDataState, string> = {
    live: 'bg-emerald-100 text-emerald-900',
    delayed: 'bg-amber-100 text-amber-900',
    stale: 'bg-orange-100 text-orange-900',
    offline: 'bg-rose-100 text-rose-900',
    missing: 'bg-slate-200 text-slate-700',
    unavailable: 'bg-slate-200 text-slate-700',
    blocked: 'bg-violet-100 text-violet-900',
    provisional: 'bg-sky-100 text-sky-900',
    loading: 'bg-slate-200 text-slate-700',
};

const LABELS: Record<ExtendedDataState, Record<'ko' | 'en', string>> = {
    live: { ko: '실시간', en: 'Live' },
    delayed: { ko: '지연', en: 'Delayed' },
    stale: { ko: '오래됨', en: 'Stale' },
    offline: { ko: '오프라인', en: 'Offline' },
    missing: { ko: '미수신', en: 'Missing' },
    unavailable: { ko: '사용 불가', en: 'Unavailable' },
    blocked: { ko: '차단', en: 'Blocked' },
    provisional: { ko: '잠정', en: 'Provisional' },
    loading: { ko: '로딩', en: 'Loading' },
};

export default function DataStateBadge({ state, label, className }: DataStateBadgeProps) {
    const { locale } = useLocale();

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em]',
                BADGE_CLASSNAME[state],
                className,
            )}
        >
            {label ?? LABELS[state][locale]}
        </span>
    );
}
