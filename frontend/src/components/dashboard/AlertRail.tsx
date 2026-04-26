import type { CSSProperties } from 'react';
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import { cn } from '../../utils/cn';
import { StatusChip } from '../ui/status-chip';

export interface AlertRailItem {
    id: string;
    severity: 'critical' | 'warning' | 'info' | 'resolved';
    title: string;
    body: string;
}

interface AlertRailProps {
    items: AlertRailItem[];
    compact?: boolean;
}

const clampOneStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 1,
};

const clampTwoStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
};

function severityMeta(severity: AlertRailItem['severity']) {
    if (severity === 'critical') {
        return {
            icon: AlertTriangle,
            chipTone: 'critical' as const,
            surfaceClassName: 'border-[color:var(--sg-color-primary)] bg-[color:var(--sg-color-primary-soft)]',
            iconClassName: 'bg-white text-[color:var(--sg-color-primary)]',
        };
    }
    if (severity === 'warning') {
        return {
            icon: Clock3,
            chipTone: 'warning' as const,
            surfaceClassName: 'border-[color:var(--sg-accent-amber-soft)] bg-[color:var(--sg-accent-amber-soft)]',
            iconClassName: 'bg-white text-[color:var(--sg-accent-amber)]',
        };
    }
    if (severity === 'resolved') {
        return {
            icon: CheckCircle2,
            chipTone: 'growth' as const,
            surfaceClassName: 'border-[color:var(--sg-color-sage)] bg-[color:var(--sg-color-sage-soft)]',
            iconClassName: 'bg-white text-[color:var(--sg-color-success)]',
        };
    }
    return {
        icon: Clock3,
        chipTone: 'stable' as const,
        surfaceClassName: 'border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)]',
        iconClassName: 'bg-white text-[color:var(--sg-color-olive)]',
    };
}

type StatusChipTone = 'normal' | 'growth' | 'stable' | 'warning' | 'critical' | 'muted';

function severitySummarySurfaceClassName(severity: AlertRailItem['severity'], count: number) {
    if (count > 0) {
        return severityMeta(severity).surfaceClassName;
    }

    return 'border-[color:var(--sg-outline-soft)] bg-white';
}

function severitySummaryChipTone(severity: AlertRailItem['severity'], count: number): StatusChipTone {
    if (count > 0) {
        return severityMeta(severity).chipTone;
    }

    return 'muted';
}

export default function AlertRail({ items, compact = false }: AlertRailProps) {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            eyebrow: '긴급 알림',
            title: '바로 조치 · 확인 필요 · 운영 메모',
            description: '지금 손봐야 하거나 확인이 필요한 운영 이슈만 먼저 모아 보여줍니다.',
            empty: '현재 바로 조치할 알림은 없지만, RTR 권장안과 운영 메모는 계속 확인해 주세요.',
            severity: {
                critical: '바로 조치',
                warning: '확인 필요',
                info: '운영 메모',
                resolved: '해결 완료',
            },
            priority: '운영 우선순위',
            priorityChip: '최우선 확인',
            checkNow: '지금 점검',
            logAction: '운영 메모 남기기',
            noUrgent: '현재 바로 조치 없음',
        }
        : {
            eyebrow: 'Alerts to review',
            title: 'Actions · checks · operating notes',
            description: 'Keep only the operating issues that need action or verification now.',
            empty: 'There is no urgent alert, but the RTR recommendation and operating notes still deserve review.',
            severity: {
                critical: 'Act now',
                warning: 'Review',
                info: 'Operating note',
                resolved: 'Resolved',
            },
            priority: 'Operating priority',
            priorityChip: 'Priority check',
            checkNow: 'Check now',
            logAction: 'Log action',
            noUrgent: 'No urgent alert',
        };

    const leadItem = items[0] ?? null;
    const remainingItems = items.slice(1, 4);
    const leadMeta = leadItem ? severityMeta(leadItem.severity) : null;
    const LeadIcon = leadMeta?.icon ?? AlertTriangle;
    const severityCounts = items.reduce<Record<AlertRailItem['severity'], number>>(
        (acc, item) => {
            acc[item.severity] += 1;
            return acc;
        },
        { critical: 0, warning: 0, info: 0, resolved: 0 },
    );
    const compactItems = items.slice(0, 2);

    if (compact) {
        return (
            <section className="sg-panel flex h-full flex-col gap-3 bg-[color:var(--sg-surface-raised)] p-3" aria-labelledby="alert-rail-compact-title">
                <header>
                    <p className="sg-eyebrow">{copy.eyebrow}</p>
                    <h2 id="alert-rail-compact-title" className="mt-1 text-base font-bold leading-tight text-[color:var(--sg-text-strong)]">
                        {copy.title}
                    </h2>
                </header>
                <div className="grid grid-cols-2 gap-2">
                    {(['critical', 'warning', 'info', 'resolved'] as const).map((severity) => {
                        const count = severityCounts[severity];
                        return (
                            <div
                                key={severity}
                                className={cn('sg-panel px-2.5 py-2', severitySummarySurfaceClassName(severity, count))}
                            >
                                <StatusChip tone={severitySummaryChipTone(severity, count)} className="px-2 py-0.5 text-[10px]">
                                    {copy.severity[severity]}
                                </StatusChip>
                                <div className="sg-data-number mt-1 text-lg font-bold leading-none text-[color:var(--sg-text-strong)]">
                                    {count}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex min-h-0 flex-col gap-2.5">
                    {compactItems.length > 0 ? compactItems.map((item) => {
                        const meta = severityMeta(item.severity);
                        const Icon = meta.icon;
                        return (
                            <article
                                key={item.id}
                                className={cn('sg-panel px-3 py-2.5', meta.surfaceClassName)}
                            >
                                <div className="flex items-start gap-2.5">
                                    <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--sg-radius-sm)] shadow-[var(--sg-shadow-card)]', meta.iconClassName)}>
                                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <StatusChip tone={meta.chipTone} className="px-2 py-0.5 text-[10px]">{copy.severity[item.severity]}</StatusChip>
                                        <div className="mt-1 text-sm font-semibold leading-5" style={clampOneStyle}>
                                            {item.title}
                                        </div>
                                        <p className="mt-1 text-xs leading-5 opacity-90" style={clampTwoStyle}>
                                            {item.body}
                                        </p>
                                    </div>
                                </div>
                            </article>
                        );
                    }) : (
                        <div
                            className="sg-panel bg-white px-3 py-3 text-sm text-[color:var(--sg-text-muted)]"
                        >
                            {copy.noUrgent}
                        </div>
                    )}
                </div>
            </section>
        );
    }

    return (
        <section className="sg-panel bg-[color:var(--sg-surface-raised)] p-3 md:p-4" aria-labelledby="alert-rail-title">
            <header className="overview-section-heading">
                <div>
                    <p className="sg-eyebrow">{copy.eyebrow}</p>
                    <h2 id="alert-rail-title">{copy.title}</h2>
                    <p className="mt-1 max-w-2xl text-[0.8rem] leading-5 text-[color:var(--sg-text-muted)]">
                        {copy.description}
                    </p>
                </div>
            </header>
            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
                <div className="space-y-3">
                    <article className={cn('sg-panel p-3 md:p-4', leadMeta?.surfaceClassName ?? 'bg-[color:var(--sg-surface-warm)]')}>
                        <div className="flex items-start gap-3">
                            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sg-radius-md)] shadow-[var(--sg-shadow-card)]', leadMeta?.iconClassName ?? 'bg-white text-[color:var(--sg-color-olive)]')}>
                                <LeadIcon className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusChip tone={leadMeta?.chipTone ?? 'stable'}>{leadItem ? copy.severity[leadItem.severity] : copy.noUrgent}</StatusChip>
                                    {leadItem ? <StatusChip tone="muted">{copy.priorityChip}</StatusChip> : null}
                                </div>
                                <h3 className="mt-3 text-xl font-bold leading-tight text-[color:var(--sg-text-strong)]">
                                    {leadItem ? leadItem.title : copy.noUrgent}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                                    {leadItem ? leadItem.body : copy.empty}
                                </p>
                                {leadItem ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <StatusChip tone="warning">{copy.checkNow}</StatusChip>
                                        <StatusChip tone="stable">{copy.logAction}</StatusChip>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </article>
                    <div className="grid grid-cols-2 gap-2">
                        {(['critical', 'warning', 'info', 'resolved'] as const).map((severity) => {
                            const count = severityCounts[severity];
                            return (
                                <div
                                    key={severity}
                                    className={cn('sg-panel px-3 py-2.5', severitySummarySurfaceClassName(severity, count))}
                                >
                                    <StatusChip tone={severitySummaryChipTone(severity, count)} className="px-2 py-0.5 text-[10px]">
                                        {copy.severity[severity]}
                                    </StatusChip>
                                    <div className="sg-data-number mt-2 text-xl font-bold leading-none text-[color:var(--sg-text-strong)]">
                                        {count}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="space-y-2.5">
                    <div className="flex items-end justify-between gap-2">
                        <div>
                            <p className="sg-eyebrow">{copy.priority}</p>
                            <h3 className="mt-1 text-base font-bold text-[color:var(--sg-text-strong)]">{copy.priorityChip}</h3>
                        </div>
                    </div>
                    {remainingItems.length > 0 ? (
                        <div className="grid gap-2.5">
                        {remainingItems.map((item) => {
                            const meta = severityMeta(item.severity);
                            const Icon = meta.icon;
                            return (
                                <div
                                    key={item.id}
                                    className={cn('sg-panel px-3 py-3', meta.surfaceClassName)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sg-radius-sm)] shadow-[var(--sg-shadow-card)]', meta.iconClassName)}>
                                            <Icon className="h-4 w-4" aria-hidden="true" />
                                        </div>
                                        <div className="min-w-0">
                                            <StatusChip tone={meta.chipTone} className="px-2 py-0.5 text-[10px]">{copy.severity[item.severity]}</StatusChip>
                                            <div className="mt-1.5 text-sm font-bold text-[color:var(--sg-text-strong)]">{item.title}</div>
                                            <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]" style={clampTwoStyle}>{item.body}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    ) : (
                        <div className="sg-panel bg-white px-3 py-4 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                            {leadItem ? copy.empty : copy.noUrgent}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
