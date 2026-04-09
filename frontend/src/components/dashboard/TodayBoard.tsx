import { Activity, CalendarDays, Radar, TimerReset } from 'lucide-react';
import DashboardCard from '../common/DashboardCard';
import { useLocale } from '../../i18n/LocaleProvider';

interface TodayBoardProps {
    actionsNow: string[];
    actionsToday: string[];
    actionsWeek: string[];
    monitor: string[];
}

function ActionSheet({
    title,
    items,
    emptyLabel,
    tone,
    prominent = false,
    icon,
}: {
    title: string;
    items: string[];
    emptyLabel: string;
    tone: 'green' | 'blue' | 'amber' | 'violet';
    prominent?: boolean;
    icon: typeof Activity;
}) {
    const Icon = icon;
    const toneClass = {
        green: 'sg-tint-green',
        blue: 'sg-tint-amber',
        amber: 'sg-tint-amber',
        violet: 'sg-tint-violet',
    }[tone];
    const leadItem = items[0] ?? null;
    const supportingItems = leadItem ? items.slice(1, 4) : [];

    return (
        <article
            className={`rounded-[30px] px-4 py-4 ${toneClass} ${prominent ? 'py-5' : ''}`}
            style={{ boxShadow: prominent ? 'var(--sg-shadow-soft)' : 'var(--sg-shadow-card)' }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-white/82 text-[color:var(--sg-text-strong)]"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="sg-eyebrow">{title}</div>
                        <div className="mt-1 text-sm text-[color:var(--sg-text-muted)]">
                            {items.length > 0 ? `${items.length} items` : emptyLabel}
                        </div>
                    </div>
                </div>
                <div
                    className="rounded-full bg-white/72 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--sg-text-muted)]"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    {items.length}
                </div>
            </div>

            {leadItem ? (
                <div className="mt-4 space-y-3">
                    <div
                        className={`rounded-[26px] bg-white/84 px-4 py-4 ${prominent ? 'min-h-[8.5rem]' : ''}`}
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--sg-accent-forest-soft)] text-xs font-semibold text-[color:var(--sg-accent-forest)]">
                                01
                            </div>
                            <div className={`min-w-0 ${prominent ? 'text-base leading-7' : 'text-sm leading-6'} text-[color:var(--sg-text-strong)]`}>
                                {leadItem}
                            </div>
                        </div>
                    </div>

                    {supportingItems.length > 0 ? (
                        <div className="space-y-2">
                            {supportingItems.map((item, index) => (
                                <div
                                    key={item}
                                    className="rounded-[22px] bg-white/74 px-4 py-3 text-sm leading-6 text-[color:var(--sg-text-strong)]"
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/86 text-[11px] font-semibold text-[color:var(--sg-text-muted)]">
                                            {String(index + 2).padStart(2, '0')}
                                        </div>
                                        <div className="min-w-0">{item}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : (
                <p className="mt-4 rounded-[22px] bg-white/76 px-4 py-4 text-sm leading-6 text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                    {emptyLabel}
                </p>
            )}
        </article>
    );
}

export default function TodayBoard({
    actionsNow,
    actionsToday,
    actionsWeek,
    monitor,
}: TodayBoardProps) {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            eyebrow: '오늘 운영 보드',
            title: '지금 · 오늘 · 이번주 운영 보드',
            description: '설명보다 먼저 실행할 것과 추적만 해도 되는 것을 분리했습니다.',
            leadLabel: '오늘 운영 방향',
            leadFallback: '현재는 큰 제어 전환보다 리듬 유지와 추세 확인이 더 중요합니다.',
            leadSupport: '이 보드는 즉시 조치, 오늘 조정, 주간 검토, 추가 확인을 한 화면에서 정리합니다.',
            now: '지금',
            today: '오늘',
            week: '이번주',
            monitor: '추가 확인',
            emptyNow: '지금은 상태를 급하게 바꾸기보다 추세 확인이 우선입니다.',
            emptyToday: '오늘은 현재 제어안과 작업 리듬을 유지해도 됩니다.',
            emptyWeek: '주간 수준 조정은 아직 강하게 필요하지 않습니다.',
            emptyMonitor: '특별히 붙잡아야 할 추가 모니터링 항목이 없습니다.',
            counts: {
                now: '즉시 조치',
                today: '오늘 조정',
                week: '주간 검토',
                monitor: '확인 포인트',
            },
        }
        : {
            eyebrow: 'Today board',
            title: 'Now · Today · This week',
            description: 'Separate immediate moves from the items that only need tracking.',
            leadLabel: 'Operating direction',
            leadFallback: 'Holding the current rhythm matters more than forcing a large control change.',
            leadSupport: 'This board keeps immediate action, today steering, weekly review, and monitoring in one place.',
            now: 'Now',
            today: 'Today',
            week: 'This week',
            monitor: 'Monitor',
            emptyNow: 'Trend confirmation matters more than a rapid control change right now.',
            emptyToday: 'The current control plan and work rhythm can stay in place for today.',
            emptyWeek: 'No strong weekly intervention is needed yet.',
            emptyMonitor: 'There are no additional watch items that require active follow-up.',
            counts: {
                now: 'Immediate moves',
                today: 'Today steering',
                week: 'Weekly review',
                monitor: 'Watch points',
            },
        };

    const leadMessage = actionsNow[0] ?? actionsToday[0] ?? actionsWeek[0] ?? monitor[0] ?? copy.leadFallback;
    const countTiles = [
        { key: 'now', label: copy.counts.now, value: actionsNow.length, tone: 'sg-tint-green' },
        { key: 'today', label: copy.counts.today, value: actionsToday.length, tone: 'sg-tint-amber' },
        { key: 'week', label: copy.counts.week, value: actionsWeek.length, tone: 'sg-tint-violet' },
        { key: 'monitor', label: copy.counts.monitor, value: monitor.length, tone: 'sg-tint-amber' },
    ] as const;

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
        >
            <div className="space-y-4">
                <div
                    className="rounded-[34px] bg-[linear-gradient(135deg,rgba(255,251,246,0.98),rgba(247,230,214,0.82)_55%,rgba(242,218,218,0.78))] px-5 py-5"
                    style={{ boxShadow: 'var(--sg-shadow-soft)' }}
                >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                        <div className="min-w-0">
                            <div className="sg-eyebrow">{copy.leadLabel}</div>
                            <div className="mt-3 text-[clamp(1.5rem,1.1rem+0.9vw,2.35rem)] font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                                {leadMessage}
                            </div>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--sg-text-muted)]">
                                {copy.leadSupport}
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {countTiles.map((tile) => (
                                <div
                                    key={tile.key}
                                    className={`rounded-[24px] px-4 py-4 ${tile.tone}`}
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                                        {tile.label}
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                                        {tile.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
                    <div className="space-y-4">
                        <ActionSheet title={copy.now} items={actionsNow} emptyLabel={copy.emptyNow} tone="green" prominent icon={TimerReset} />
                        <ActionSheet title={copy.today} items={actionsToday} emptyLabel={copy.emptyToday} tone="blue" prominent icon={CalendarDays} />
                    </div>
                    <div className="space-y-4">
                        <ActionSheet title={copy.week} items={actionsWeek} emptyLabel={copy.emptyWeek} tone="violet" icon={Activity} />
                        <ActionSheet title={copy.monitor} items={monitor} emptyLabel={copy.emptyMonitor} tone="amber" icon={Radar} />
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
}
