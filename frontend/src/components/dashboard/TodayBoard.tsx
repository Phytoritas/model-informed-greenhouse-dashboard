import type { CSSProperties } from 'react';
import { Activity, CalendarDays, Radar, TimerReset } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDateTime } from '../../i18n/locale';
import { cn } from '../../utils/cn';
import { StatusChip } from '../ui/status-chip';

interface TodayBoardProps {
    actionsNow: string[];
    actionsToday: string[];
    actionsWeek: string[];
    monitor: string[];
    advisorUpdatedAt?: number | null;
    advisorRefreshing?: boolean;
    compact?: boolean;
}

const clampTwoStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
};

const clampThreeStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
};

function CompactListTile({
    title,
    items,
    emptyLabel,
    icon: Icon,
    toneClassName,
    chipTone,
    compact = false,
}: {
    title: string;
    items: string[];
    emptyLabel: string;
    icon: typeof Activity;
    toneClassName: string;
    chipTone: 'normal' | 'growth' | 'stable' | 'warning' | 'critical' | 'muted';
    compact?: boolean;
}) {
    const visibleItems = items.slice(0, compact ? 1 : 2);
    const itemClampStyle = compact ? clampThreeStyle : undefined;

    return (
        <article className={cn('sg-panel px-3 py-3', toneClassName)}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[var(--sg-radius-sm)] bg-white text-[color:var(--sg-color-olive)] shadow-[var(--sg-shadow-card)]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-[color:var(--sg-text-strong)]">{title}</div>
                        <StatusChip tone={chipTone} className="mt-1 px-2 py-0.5 text-[10px]">{items.length}</StatusChip>
                    </div>
                </div>
            </div>

            <div className="mt-2.5 space-y-2">
                {visibleItems.length > 0 ? (
                    visibleItems.map((item) => (
                        <div key={item} className="sg-panel bg-white px-3 py-2 text-sm leading-5 text-[color:var(--sg-text-strong)]">
                            <div style={itemClampStyle}>{item}</div>
                        </div>
                    ))
                ) : (
                    <div className="sg-panel bg-white px-3 py-2 text-sm leading-5 text-[color:var(--sg-text-muted)]">
                        <div style={itemClampStyle}>{emptyLabel}</div>
                    </div>
                )}
            </div>
        </article>
    );
}

export default function TodayBoard({
    actionsNow,
    actionsToday,
    actionsWeek,
    monitor,
    advisorUpdatedAt = null,
    advisorRefreshing = false,
    compact = false,
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
            leadFallback: '기존 환경 설정을 유지하며 작물 상태를 지켜보시길 권장합니다.',
            leadSupport: '즉시 조치, 오늘 조정, 주간 검토, 추가 확인을 한 번에 봅니다.',
            now: '지금',
            today: '오늘',
            week: '이번주',
            monitor: '추가 확인',
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
            leadFallback: 'Holding the current rhythm matters more than forcing a large change.',
            leadSupport: 'Read immediate work, today steering, weekly review, and watch items together.',
            now: 'Now',
            today: 'Today',
            week: 'This week',
            monitor: 'Watch',
            emptyNow: 'Hold the current state and confirm the trend.',
            emptyToday: 'The current plan can stay in place for today.',
            emptyWeek: 'No strong weekly intervention is needed yet.',
            emptyMonitor: 'There are no extra watch items right now.',
        };

    const leadMessage = actionsNow[0] ?? actionsToday[0] ?? actionsWeek[0] ?? monitor[0] ?? copy.leadFallback;
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
    const queueTiles = [
        {
            key: 'now',
            label: copy.now,
            value: actionsNow.length,
            toneClassName: actionsNow.length ? 'border-[color:var(--sg-color-primary)] bg-[color:var(--sg-color-primary-soft)]' : 'bg-white',
            chipTone: actionsNow.length ? 'critical' : 'muted',
            icon: TimerReset,
            items: actionsNow,
            emptyLabel: copy.emptyNow,
        },
        {
            key: 'today',
            label: copy.today,
            value: actionsToday.length,
            toneClassName: actionsToday.length ? 'border-[color:var(--sg-accent-amber-soft)] bg-[color:var(--sg-accent-amber-soft)]' : 'bg-white',
            chipTone: actionsToday.length ? 'warning' : 'muted',
            icon: CalendarDays,
            items: actionsToday,
            emptyLabel: copy.emptyToday,
        },
        {
            key: 'week',
            label: copy.week,
            value: actionsWeek.length,
            toneClassName: actionsWeek.length ? 'border-[color:var(--sg-color-sage)] bg-[color:var(--sg-color-sage-soft)]' : 'bg-white',
            chipTone: actionsWeek.length ? 'growth' : 'muted',
            icon: Activity,
            items: actionsWeek,
            emptyLabel: copy.emptyWeek,
        },
        {
            key: 'monitor',
            label: copy.monitor,
            value: monitor.length,
            toneClassName: monitor.length ? 'border-[color:var(--sg-color-olive)] bg-[color:var(--sg-color-olive-soft)]' : 'bg-white',
            chipTone: monitor.length ? 'stable' : 'muted',
            icon: Radar,
            items: monitor,
            emptyLabel: copy.emptyMonitor,
        },
    ] as const;

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

            <div className={`mt-3 grid gap-3 ${compact ? 'xl:grid-cols-1' : 'xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]'}`}>
                <article className="sg-panel border-[color:var(--sg-color-sage)] bg-[color:var(--sg-color-sage-soft)] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusChip tone="growth">{copy.leadLabel}</StatusChip>
                        {advisorFreshnessLabel ? (
                            <StatusChip tone={advisorRefreshing ? 'warning' : 'stable'} className="px-2 py-0.5 text-[10px]">
                                {advisorFreshnessLabel}
                            </StatusChip>
                        ) : null}
                    </div>
                    <div className="mt-3 text-[clamp(1.2rem,1rem+0.5vw,1.7rem)] font-bold leading-tight text-[color:var(--sg-text-strong)]" style={compact ? clampThreeStyle : clampTwoStyle}>
                        {leadMessage}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]" style={compact ? clampThreeStyle : undefined}>
                        {copy.leadSupport}
                    </p>
                </article>

                <div className="grid grid-cols-2 gap-2">
                    {queueTiles.map((tile) => (
                        <div
                            key={tile.key}
                            className={cn('sg-panel px-3 py-2.5', tile.toneClassName)}
                        >
                            <StatusChip tone={tile.chipTone} className="px-2 py-0.5 text-[10px]">{tile.label}</StatusChip>
                            <div className="sg-data-number mt-2 text-2xl font-bold leading-none text-[color:var(--sg-text-strong)]">
                                {tile.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={`mt-3 grid gap-3 ${compact ? 'md:grid-cols-1 xl:grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
                {queueTiles.map((tile) => (
                    <CompactListTile
                        key={tile.key}
                        title={tile.label}
                        items={tile.items}
                        emptyLabel={tile.emptyLabel}
                        icon={tile.icon}
                        toneClassName={tile.toneClassName}
                        chipTone={tile.chipTone}
                        compact={compact}
                    />
                ))}
            </div>
        </section>
    );
}
