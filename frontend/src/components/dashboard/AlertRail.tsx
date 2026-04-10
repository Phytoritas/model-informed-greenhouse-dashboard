import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import DashboardCard from '../common/DashboardCard';

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

function severityMeta(severity: AlertRailItem['severity']) {
    if (severity === 'critical') {
        return {
            icon: AlertTriangle,
            className: 'bg-rose-50 text-rose-900',
        };
    }
    if (severity === 'warning') {
        return {
            icon: Clock3,
            className: 'bg-amber-50 text-amber-900',
        };
    }
    if (severity === 'resolved') {
        return {
            icon: CheckCircle2,
            className: 'bg-[color:var(--sg-accent-earth-soft)] text-[color:var(--sg-accent-earth)]',
        };
    }
    return {
        icon: Clock3,
        className: 'bg-[color:var(--sg-surface-warm)] text-[color:var(--sg-text-strong)]',
    };
}

export default function AlertRail({ items, compact = false }: AlertRailProps) {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            eyebrow: '주의 알림',
            title: '바로 조치 · 주의 확인 · 운영 메모',
            description: '지금 손봐야 하거나 확인이 필요한 운영 이슈만 먼저 모아 보여줍니다.',
            empty: '현재 바로 조치할 알림은 없지만, RTR 권장안과 운영 메모는 계속 확인해 주세요.',
            severity: {
                critical: '바로 조치',
                warning: '주의 확인',
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

    return (
        <DashboardCard
            variant="alert"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
        >
            <div className="space-y-3">
                <div className={`grid gap-3 ${compact ? 'sm:grid-cols-1' : 'sm:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]'}`}>
                    <div
                        className="rounded-[28px] px-4 py-4 sg-tint-amber"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                            {copy.priority}
                        </div>
                        <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                            {leadItem ? leadItem.title : copy.noUrgent}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                            {leadItem ? leadItem.body : copy.empty}
                        </p>
                    </div>
                    <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
                        {(['critical', 'warning', 'info', 'resolved'] as const).map((severity) => (
                            <div
                                key={severity}
                                className={`rounded-[22px] px-4 py-3 ${severityMeta(severity).className}`}
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                                    {copy.severity[severity]}
                                </div>
                                <div className="mt-2 text-xl font-semibold tracking-[-0.05em]">
                                    {severityCounts[severity]}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {leadItem ? (
                    <div
                        className={`rounded-[30px] px-5 py-5 ${leadMeta?.className ?? 'bg-[color:var(--sg-surface-warm)] text-[color:var(--sg-text-strong)]'}`}
                        style={{ boxShadow: 'var(--sg-shadow-soft)' }}
                    >
                        <div className="flex items-start gap-4">
                            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/75">
                                <LeadIcon className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                                        {copy.severity[leadItem.severity]}
                                    </div>
                                    <span
                                        className="rounded-full bg-white/78 px-2.5 py-1 text-[10px] font-semibold text-[color:var(--sg-text-strong)]"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        {copy.priorityChip}
                                    </span>
                                </div>
                                <div className="mt-3 text-xl font-semibold tracking-[-0.05em]">{leadItem.title}</div>
                                <p className="mt-3 text-sm leading-6 opacity-90">{leadItem.body}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <span
                                        className="rounded-full bg-white/78 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--sg-text-strong)]"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        {copy.checkNow}
                                    </span>
                                    <span
                                        className="rounded-full bg-white/62 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--sg-text-strong)]"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        {copy.logAction}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
                {remainingItems.length > 0 ? (
                    <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'lg:grid-cols-3'}`}>
                        {remainingItems.map((item) => {
                            const meta = severityMeta(item.severity);
                            const Icon = meta.icon;
                            return (
                                <div
                                    key={item.id}
                                    className={`rounded-[24px] px-4 py-4 ${meta.className}`}
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-white/70">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold">{item.title}</div>
                                            <p className="mt-1 text-sm leading-6 opacity-90">{item.body}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : !leadItem ? (
                    <div
                        className="rounded-[24px] bg-white/75 px-4 py-4 text-sm text-[color:var(--sg-text-muted)]"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        {copy.empty}
                    </div>
                ) : null}
            </div>
        </DashboardCard>
    );
}
