import type { CSSProperties } from 'react';
import { Activity, CalendarDays, Radar, TimerReset } from 'lucide-react';
import DashboardCard from '../common/DashboardCard';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDateTime } from '../../i18n/locale';

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
    tone,
    compact = false,
}: {
    title: string;
    items: string[];
    emptyLabel: string;
    icon: typeof Activity;
    tone: string;
    compact?: boolean;
}) {
    const visibleItems = items.slice(0, compact ? 1 : 2);
    const itemClampStyle = compact ? clampThreeStyle : undefined;

    return (
        <article className={`rounded-[22px] px-4 py-4 ${tone}`} style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-white/84 text-[color:var(--sg-text-strong)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{title}</div>
                </div>
                <div className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-[color:var(--sg-text-faint)]">
                    {items.length}
                </div>
            </div>

            <div className="mt-3 space-y-2">
                {visibleItems.length > 0 ? (
                    visibleItems.map((item) => (
                        <div key={item} className="rounded-[18px] bg-white/76 px-3 py-2.5 text-sm leading-6 text-[color:var(--sg-text-strong)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div style={itemClampStyle}>{item}</div>
                        </div>
                    ))
                ) : (
                    <div className="rounded-[18px] bg-white/70 px-3 py-2.5 text-sm leading-6 text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
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
    const countTiles = [
        { key: 'now', label: copy.now, value: actionsNow.length, tone: 'sg-tint-green' },
        { key: 'today', label: copy.today, value: actionsToday.length, tone: 'sg-tint-amber' },
        { key: 'week', label: copy.week, value: actionsWeek.length, tone: 'sg-tint-violet' },
        { key: 'monitor', label: copy.monitor, value: monitor.length, tone: 'sg-tint-neutral' },
    ] as const;

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            contentClassName="flex flex-col gap-4"
            className={compact ? undefined : 'h-full overflow-hidden'}
        >
            <div className={`grid gap-4 ${compact ? 'xl:grid-cols-1' : 'xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]'}`}>
                <div className="rounded-[26px] bg-[linear-gradient(135deg,rgba(255,251,246,0.98),rgba(248,231,223,0.9))] px-5 py-5" style={{ boxShadow: 'var(--sg-shadow-soft)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                            {copy.leadLabel}
                        </div>
                        {advisorFreshnessLabel ? (
                            <div className="rounded-full bg-white/84 px-2.5 py-1 text-[10px] font-semibold text-[color:var(--sg-text-faint)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                {advisorFreshnessLabel}
                            </div>
                        ) : null}
                    </div>
                    <div className="mt-3 text-[clamp(1.35rem,1.05rem+0.6vw,1.9rem)] font-semibold leading-tight tracking-[-0.05em] text-[color:var(--sg-text-strong)]" style={compact ? clampThreeStyle : clampTwoStyle}>
                        {leadMessage}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--sg-text-muted)]" style={compact ? clampThreeStyle : undefined}>
                        {copy.leadSupport}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {countTiles.map((tile) => (
                        <div
                            key={tile.key}
                            className={`rounded-[20px] px-4 py-3 ${tile.tone}`}
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                {tile.label}
                            </div>
                            <div className="mt-2 text-2xl font-semibold leading-none tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                                {tile.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={`grid gap-3 ${compact ? 'md:grid-cols-1 xl:grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
                <CompactListTile title={copy.now} items={actionsNow} emptyLabel={copy.emptyNow} icon={TimerReset} tone="sg-tint-green" compact={compact} />
                <CompactListTile title={copy.today} items={actionsToday} emptyLabel={copy.emptyToday} icon={CalendarDays} tone="sg-tint-amber" compact={compact} />
                <CompactListTile title={copy.week} items={actionsWeek} emptyLabel={copy.emptyWeek} icon={Activity} tone="sg-tint-violet" compact={compact} />
                <CompactListTile title={copy.monitor} items={monitor} emptyLabel={copy.emptyMonitor} icon={Radar} tone="sg-tint-neutral" compact={compact} />
            </div>
        </DashboardCard>
    );
}
