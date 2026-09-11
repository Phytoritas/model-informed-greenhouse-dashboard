import { Activity, CalendarDays, Radar, TimerReset } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDateTime } from '../../i18n/locale';
import { cn } from '../../utils/cn';
import { AlertCard } from '../ui/alert-card';
import { StatusChip } from '../ui/status-chip';

interface TodayBoardProps {
    actionsNow: string[];
    actionsToday: string[];
    actionsWeek: string[];
    monitor: string[];
    advisorUpdatedAt?: number | null;
    advisorRefreshing?: boolean;
    compact?: boolean;
    onOpenAdvisor?: () => void;
    onOpenRtr?: () => void;
}

/**
 * Advisor output grouped by horizon. Each slot shows only what the advisor actually
 * returned; an empty slot says so plainly instead of implying an all-clear that the
 * model never asserted.
 */
export default function TodayBoard({
    actionsNow,
    actionsToday,
    actionsWeek,
    monitor,
    advisorUpdatedAt = null,
    advisorRefreshing = false,
    compact = false,
    onOpenAdvisor,
    onOpenRtr,
}: TodayBoardProps) {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            eyebrow: '분석 결과 정리',
            title: '지금 · 오늘 · 이번 주',
            description: '분석이 내놓은 내용을 시점별로 나눠 보여 줍니다.',
            refreshing: '분석 갱신 중',
            updated: '분석 시각',
            now: '지금',
            today: '오늘',
            week: '이번 주',
            monitor: '지켜볼 항목',
            details: '자세히 보기',
            compare: '설정 비교하기',
            hasItem: '분석 결과 있음',
            noItem: '분석 결과 없음',
            emptyNow: '지금 시점으로 나온 내용이 없습니다.',
            emptyToday: '오늘 시점으로 나온 내용이 없습니다.',
            emptyWeek: '이번 주 시점으로 나온 내용이 없습니다.',
            emptyMonitor: '따로 지켜보라고 나온 항목이 없습니다.',
            demoNote: '시뮬레이션 결과입니다. 장비를 직접 제어하지 않습니다.',
        }
        : {
            eyebrow: 'Advisor output',
            title: 'Now · Today · This week',
            description: 'What the analysis returned, split by horizon.',
            refreshing: 'Refreshing',
            updated: 'Analysed',
            now: 'Now',
            today: 'Today',
            week: 'This week',
            monitor: 'Watch',
            details: 'See details',
            compare: 'Compare settings',
            hasItem: 'Has output',
            noItem: 'No output',
            emptyNow: 'Nothing was returned for this moment.',
            emptyToday: 'Nothing was returned for today.',
            emptyWeek: 'Nothing was returned for this week.',
            emptyMonitor: 'No separate watch item was returned.',
            demoNote: 'Simulation output. No equipment is controlled directly.',
        };

    const advisorFreshnessLabel = advisorRefreshing
        ? copy.refreshing
        : advisorUpdatedAt
            ? `${copy.updated} ${formatLocaleDateTime(locale, advisorUpdatedAt, {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            })}`
            : null;

    // Presence of advisor text is the only thing these chips report. They deliberately
    // carry no severity, because the horizon alone does not say how urgent an item is.
    const actionCards = [
        {
            key: 'now',
            title: copy.now,
            icon: TimerReset,
            item: actionsNow[0],
            empty: copy.emptyNow,
            actionLabel: onOpenAdvisor ? copy.details : undefined,
            onAction: onOpenAdvisor,
        },
        {
            key: 'today',
            title: copy.today,
            icon: CalendarDays,
            item: actionsToday[0],
            empty: copy.emptyToday,
            actionLabel: onOpenAdvisor ? copy.details : undefined,
            onAction: onOpenAdvisor,
        },
        {
            key: 'week',
            title: copy.week,
            icon: Activity,
            item: actionsWeek[0],
            empty: copy.emptyWeek,
            actionLabel: (onOpenRtr ?? onOpenAdvisor) ? copy.compare : undefined,
            onAction: onOpenRtr ?? onOpenAdvisor,
        },
        {
            key: 'monitor',
            title: copy.monitor,
            icon: Radar,
            item: monitor[0],
            empty: copy.emptyMonitor,
            actionLabel: onOpenAdvisor ? copy.details : undefined,
            onAction: onOpenAdvisor,
        },
    ];

    return (
        <section className={cn('sg-panel bg-[color:var(--sg-surface-raised)] p-3 md:p-4', !compact && 'h-full overflow-hidden')} aria-labelledby="today-board-title">
            <header className="overview-section-heading">
                <div>
                    <p className="sg-eyebrow">{copy.eyebrow}</p>
                    <h2 id="today-board-title">{copy.title}</h2>
                    <p className="mt-1 max-w-2xl text-[0.8rem] leading-5 text-[color:var(--sg-text-muted)]">
                        {copy.description}
                    </p>
                </div>
                {advisorFreshnessLabel ? (
                    <StatusChip tone={advisorRefreshing ? 'warning' : 'stable'} className="px-2 py-0.5 text-[10px]">
                        {advisorFreshnessLabel}
                    </StatusChip>
                ) : null}
            </header>

            <div className={cn('mt-3', compact ? 'grid gap-2 md:grid-cols-2' : 'overview-card-row-4')}>
                {actionCards.map((card) => {
                    const hasItem = Boolean(card.item);
                    return (
                        <AlertCard
                            key={card.key}
                            title={card.title}
                            body={card.item ?? card.empty}
                            chip={hasItem ? copy.hasItem : copy.noItem}
                            tone={hasItem ? 'stable' : 'muted'}
                            icon={card.icon}
                            actionLabel={hasItem ? card.actionLabel : undefined}
                            onAction={hasItem ? card.onAction : undefined}
                            className={compact ? 'min-h-[96px]' : 'min-h-[112px]'}
                        />
                    );
                })}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[color:var(--sg-text-faint)]">{copy.demoNote}</p>
        </section>
    );
}
