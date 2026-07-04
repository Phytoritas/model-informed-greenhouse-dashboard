import type { TelemetryStatus } from '../../types';
import type { KpiTileData } from '../KpiStrip';
import { cn } from '../../utils/cn';
import DashboardCard from '../common/DashboardCard';
import AlertRail, { type AlertRailItem } from '../dashboard/AlertRail';
import LiveMetricStrip from '../dashboard/LiveMetricStrip';
import { StatusChip, type StatusChipTone } from '../ui/status-chip';

const SEVERITY_CHIP_TONE: Record<AlertRailItem['severity'], StatusChipTone> = {
    critical: 'critical',
    warning: 'warning',
    info: 'muted',
    resolved: 'growth',
};

interface AlertsCommandCenterProps {
    locale: 'ko' | 'en';
    items: AlertRailItem[];
    telemetryStatus: TelemetryStatus;
    statusSummary: string;
    primaryTiles: KpiTileData[];
    secondaryTiles: KpiTileData[];
    activePanel?: 'alerts-priority' | 'alerts-stream' | 'alerts-history';
}

export default function AlertsCommandCenter({
    locale,
    items,
    telemetryStatus,
    statusSummary,
    primaryTiles,
    secondaryTiles,
    activePanel = 'alerts-priority',
}: AlertsCommandCenterProps) {
    const copy = locale === 'ko'
        ? {
            eyebrow: '긴급 알림 요약',
            title: '긴급 알림과 확인 필요를 바로 가릅니다',
            description: '지금 확인할 항목과 처리 이력을 한 화면에서 정리합니다.',
            critical: '긴급 알림',
            warning: '확인 필요',
            resolved: '처리 완료',
            next: '다음 확인',
            empty: '현재 바로 조치할 항목은 없습니다. 센서 신선도와 운영 메모만 유지 점검하세요.',
            severity: {
                critical: '긴급 알림',
                warning: '확인 필요',
                info: '운영 메모',
                resolved: '처리 완료',
            },
        }
        : {
            eyebrow: 'Alert summary',
            title: 'Separate urgent and review items',
            description: 'Keep urgent checks, warnings, and handling history in one page.',
            critical: 'Urgent',
            warning: 'Warning',
            resolved: 'Handled',
            next: 'Next check',
            empty: 'There is no urgent alert right now. Keep telemetry freshness and operating notes in view.',
            severity: {
                critical: 'Urgent',
                warning: 'Warning',
                info: 'Operational note',
                resolved: 'Handled',
            },
        };

    const counts = items.reduce(
        (acc, item) => {
            acc[item.severity] += 1;
            return acc;
        },
        { critical: 0, warning: 0, info: 0, resolved: 0 },
    );
    const leadItem = items[0] ?? null;
    const summaryCards: { label: string; value: string; detail: string; tone: StatusChipTone; toneClass: string }[] = [
        {
            label: copy.critical,
            value: `${counts.critical}`,
            detail: leadItem?.severity === 'critical' ? leadItem.title : copy.empty,
            tone: 'critical',
            toneClass: 'bg-[color:var(--sg-accent-rose-soft)]',
        },
        {
            label: copy.warning,
            value: `${counts.warning}`,
            detail: locale === 'ko' ? '결로·병해·센서 지연 같은 확인 항목입니다.' : 'Review condensation, disease, and delayed-sensor checks.',
            tone: 'warning',
            toneClass: 'bg-[color:var(--sg-accent-amber-soft)]',
        },
        {
            label: copy.resolved,
            value: `${counts.resolved}`,
            detail: locale === 'ko' ? '최근 정리된 항목도 같은 화면에서 확인합니다.' : 'Keep recently resolved items in the same lane.',
            tone: 'growth',
            toneClass: 'bg-[color:var(--sg-color-sage-soft)]',
        },
        {
            label: copy.next,
            value: leadItem?.title ?? statusSummary,
            detail: leadItem?.body ?? copy.empty,
            tone: 'muted',
            toneClass: 'bg-[color:var(--sg-surface-warm)]',
        },
    ];
    const resolvedItems = items.filter((item) => item.severity === 'resolved');

    return (
        <div className="space-y-6">
            <DashboardCard
                eyebrow={copy.eyebrow}
                title={copy.title}
                description={copy.description}
                variant="hero"
            >
                <div className="grid gap-3 xl:grid-cols-4">
                    {summaryCards.map((card) => (
                        <article
                            key={card.label}
                            className={cn('sg-panel px-4 py-4', card.toneClass)}
                        >
                            <StatusChip tone={card.tone}>{card.label}</StatusChip>
                            <div className="sg-data-number mt-2 text-lg font-bold tracking-[-0.02em] text-[color:var(--sg-text-strong)]">
                                {card.value}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                                {card.detail}
                            </p>
                        </article>
                    ))}
                </div>
            </DashboardCard>

            {activePanel === 'alerts-priority' ? <AlertRail items={items} /> : null}
            {activePanel === 'alerts-stream' ? (
                <LiveMetricStrip
                    statusSummary={statusSummary}
                    telemetryStatus={telemetryStatus}
                    primaryTiles={primaryTiles}
                    secondaryTiles={secondaryTiles}
                />
            ) : null}
            {activePanel === 'alerts-history' ? (
                <DashboardCard
                    eyebrow={copy.resolved}
                    title={locale === 'ko' ? '최근 정리한 알림과 운영 메모' : 'Recently resolved alerts and notes'}
                    description={locale === 'ko'
                        ? '해결 완료로 넘어간 항목과 운영 메모를 한곳에서 다시 확인합니다.'
                        : 'Review the items that recently moved into resolved status.'}
                >
                    <div className="grid gap-3">
                        {(resolvedItems.length ? resolvedItems : items.slice(0, 3)).map((item) => (
                            <article
                                key={item.id}
                                className="sg-panel bg-white px-4 py-4 text-sm leading-6 text-[color:var(--sg-text-strong)]"
                            >
                                <StatusChip tone={SEVERITY_CHIP_TONE[item.severity]}>
                                    {copy.severity[item.severity]}
                                </StatusChip>
                                <div className="mt-2 text-base font-semibold tracking-[-0.03em]">{item.title}</div>
                                <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">{item.body}</p>
                                {item.auxiliaryText ? (
                                    <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--sg-text-faint)]">
                                        {item.auxiliaryText}
                                    </p>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </DashboardCard>
            ) : null}
        </div>
    );
}
