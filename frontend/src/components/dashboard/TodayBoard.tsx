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
            eyebrow: '오늘 운영 보드',
            title: '지금 · 오늘 · 이번주 운영 보드',
            description: '지금 할 일과 지켜볼 항목만 짧게 묶었습니다.',
            leadLabel: '오늘 운영 방향',
            refreshing: '분석 갱신 중',
            updated: '분석',
            leadSupport: '즉시 조치, 오늘 조정, 주간 검토, 추가 확인을 한 번에 봅니다.',
            now: '지금',
            today: '오늘',
            week: '이번주',
            monitor: '추가 확인',
            details: '자세히',
            compare: '비교',
            hold: '유지',
            impact: '영향 큼',
            moderate: '확인 필요',
            recommended: '정상 범위',
            watchStatus: '감시',
            emptyNow: '지금은 상태 확인이 우선입니다.',
            emptyToday: '오늘은 현재 제어안을 유지해도 됩니다.',
            emptyWeek: '주간 수준 조정은 아직 크지 않습니다.',
            emptyMonitor: '추가로 붙잡을 항목이 없습니다.',
        }
        : {
            eyebrow: 'Today board',
            title: 'Now · Today · This week',
            description: 'Keep the action queue short and readable.',
            leadLabel: 'Operating direction',
            refreshing: 'Refreshing',
            updated: 'Updated',
            leadSupport: 'Read immediate work, today steering, weekly review, and watch items together.',
            now: 'Now',
            today: 'Today',
            week: 'This week',
            monitor: 'Watch',
            details: 'See Details',
            compare: 'Compare',
            hold: 'Hold',
            impact: 'High impact',
            moderate: 'Moderate',
            recommended: 'Recommended',
            watchStatus: 'Watch',
            emptyNow: 'Hold the current state and confirm the trend.',
            emptyToday: 'The current plan can stay in place for today.',
            emptyWeek: 'No strong weekly intervention is needed yet.',
            emptyMonitor: 'There are no extra watch items right now.',
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
    const actionCards = [
        {
            key: 'now',
            title: copy.now,
            chip: actionsNow.length ? copy.impact : copy.hold,
            tone: actionsNow.length ? 'critical' : 'stable',
            icon: TimerReset,
            body: actionsNow[0] ?? copy.emptyNow,
            actionLabel: onOpenAdvisor ? copy.details : undefined,
            onAction: onOpenAdvisor,
        },
        {
            key: 'today',
            title: copy.today,
            chip: actionsToday.length ? copy.moderate : copy.recommended,
            tone: actionsToday.length ? 'warning' : 'growth',
            icon: CalendarDays,
            body: actionsToday[0] ?? copy.emptyToday,
            actionLabel: onOpenAdvisor ? copy.details : undefined,
            onAction: onOpenAdvisor,
        },
        {
            key: 'week',
            title: copy.week,
            chip: actionsWeek.length ? copy.moderate : copy.recommended,
            tone: 'stable',
            icon: Activity,
            body: actionsWeek[0] ?? copy.emptyWeek,
            actionLabel: (onOpenRtr ?? onOpenAdvisor) ? copy.compare : undefined,
            onAction: onOpenRtr ?? onOpenAdvisor,
        },
        {
            key: 'monitor',
            title: copy.monitor,
            chip: monitor.length ? copy.watchStatus : copy.recommended,
            tone: monitor.length ? 'warning' : 'stable',
            icon: Radar,
            body: monitor[0] ?? copy.emptyMonitor,
            actionLabel: onOpenAdvisor ? copy.details : undefined,
            onAction: onOpenAdvisor,
        },
    ] satisfies Array<{
        key: string;
        title: string;
        chip: string;
        tone: 'growth' | 'stable' | 'warning' | 'critical';
        icon: typeof Activity;
        body: string;
        actionLabel?: string;
        onAction?: () => void;
    }>;

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
            </header>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone="growth">{copy.leadLabel}</StatusChip>
                    {advisorFreshnessLabel ? (
                        <StatusChip tone={advisorRefreshing ? 'warning' : 'stable'} className="px-2 py-0.5 text-[10px]">
                            {advisorFreshnessLabel}
                        </StatusChip>
                    ) : null}
                </div>
                <p className="max-w-2xl text-sm leading-6 text-[color:var(--sg-text-muted)]">
                    {copy.leadSupport}
                </p>
            </div>

            <div className={cn('mt-3', compact ? 'grid gap-2 md:grid-cols-2' : 'overview-card-row-4')}>
                {actionCards.map((card) => (
                    <AlertCard
                        key={card.key}
                        title={card.title}
                        body={card.body}
                        chip={card.chip}
                        tone={card.tone}
                        icon={card.icon}
                        actionLabel={card.actionLabel}
                        onAction={card.onAction}
                        className={compact ? 'min-h-[96px]' : 'min-h-[112px]'}
                    />
                ))}
            </div>
        </section>
    );
}
