import type { TelemetryStatus } from '../../types';
import { useLocale } from '../../i18n/LocaleProvider';
import { cn } from '../../utils/cn';

type TelemetryChipState = TelemetryStatus | 'unavailable' | 'blocked' | 'provisional';

interface TelemetryFreshnessChipProps {
    status: TelemetryChipState;
    detail?: string | null;
    className?: string;
}

const CHIP_CLASSNAME: Record<TelemetryChipState, string> = {
    loading: 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]',
    live: 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]',
    delayed: 'bg-[color:var(--sg-status-delayed-bg)] text-[color:var(--sg-status-delayed-text)]',
    stale: 'bg-[color:var(--sg-status-stale-bg)] text-[color:var(--sg-status-stale-text)]',
    offline: 'bg-[color:var(--sg-status-offline-bg)] text-[color:var(--sg-status-offline-text)]',
    unavailable: 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]',
    blocked: 'bg-[color:var(--sg-status-blocked-bg)] text-[color:var(--sg-status-blocked-text)]',
    provisional: 'bg-[color:var(--sg-status-provisional-bg)] text-[color:var(--sg-status-provisional-text)]',
};

const LABELS: Record<TelemetryChipState, Record<'ko' | 'en', string>> = {
    loading: { ko: '로딩', en: 'Loading' },
    live: { ko: '실시간', en: 'Live' },
    delayed: { ko: '지연', en: 'Delayed' },
    stale: { ko: '오래됨', en: 'Stale' },
    offline: { ko: '오프라인', en: 'Offline' },
    unavailable: { ko: '사용 불가', en: 'Unavailable' },
    blocked: { ko: '제어 제한', en: 'Blocked' },
    provisional: { ko: '잠정 계산', en: 'Provisional' },
};

export default function TelemetryFreshnessChip({
    status,
    detail,
    className,
}: TelemetryFreshnessChipProps) {
    const { locale } = useLocale();

    return (
        <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold', CHIP_CLASSNAME[status], className)}>
            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
            <span>{LABELS[status][locale]}</span>
            {detail ? <span className="hidden opacity-80 md:inline">{detail}</span> : null}
        </div>
    );
}
