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
    live: 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]',
    delayed: 'bg-[color:var(--sg-status-delayed-bg)] text-[color:var(--sg-status-delayed-text)]',
    stale: 'bg-[color:var(--sg-status-stale-bg)] text-[color:var(--sg-status-stale-text)]',
    offline: 'bg-[color:var(--sg-status-offline-bg)] text-[color:var(--sg-status-offline-text)]',
    missing: 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]',
    unavailable: 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]',
    blocked: 'bg-[color:var(--sg-status-blocked-bg)] text-[color:var(--sg-status-blocked-text)]',
    provisional: 'bg-[color:var(--sg-status-provisional-bg)] text-[color:var(--sg-status-provisional-text)]',
    loading: 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]',
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
