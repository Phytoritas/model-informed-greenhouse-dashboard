import type { TelemetryStatus } from '../../types';
import type { KpiTileData } from '../KpiStrip';
import DashboardCard from '../common/DashboardCard';
import AlertRail, { type AlertRailItem } from '../dashboard/AlertRail';
import LiveMetricStrip from '../dashboard/LiveMetricStrip';

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
            eyebrow: '바로 조치 센터',
            title: '경보를 읽는 대신 바로 조치합니다',
            description: '긴급, 주의, 운영 메모를 한곳에 모아 지금 손볼 일과 다음 확인 순서를 분리합니다.',
            critical: '바로 조치',
            warning: '주의 확인',
            resolved: '해결 완료',
            next: '다음 확인',
            empty: '현재 바로 조치할 항목은 없습니다. 센서 신선도와 운영 메모만 유지 점검하세요.',
            severity: {
                critical: '바로 조치',
                warning: '주의 확인',
                info: '운영 메모',
                resolved: '해결 완료',
            },
        }
        : {
            eyebrow: 'Action center',
            title: 'Turn alerts into operating actions',
            description: 'Separate what needs action now from what only needs verification or logging.',
            critical: 'Act now',
            warning: 'Review',
            resolved: 'Resolved',
            next: 'Next check',
            empty: 'There is no urgent alert right now. Keep telemetry freshness and operating notes in view.',
            severity: {
                critical: 'Act now',
                warning: 'Review',
                info: 'Operational note',
                resolved: 'Resolved',
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
    const summaryCards = [
        {
            label: copy.critical,
            value: `${counts.critical}`,
            detail: leadItem?.severity === 'critical' ? leadItem.title : copy.empty,
            toneClass: 'sg-tint-amber',
        },
        {
            label: copy.warning,
            value: `${counts.warning}`,
            detail: locale === 'ko' ? '결로·병해·센서 지연 같은 확인 항목입니다.' : 'Review condensation, disease, and delayed-sensor checks.',
            toneClass: 'sg-tint-amber',
        },
        {
            label: copy.resolved,
            value: `${counts.resolved}`,
            detail: locale === 'ko' ? '최근 정리된 항목도 같은 화면에서 확인합니다.' : 'Keep recently resolved items in the same lane.',
            toneClass: 'sg-tint-green',
        },
        {
            label: copy.next,
            value: leadItem?.title ?? statusSummary,
            detail: leadItem?.body ?? copy.empty,
            toneClass: 'bg-white/86',
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
                            className={`rounded-[24px] px-4 py-4 ${card.toneClass}`}
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                {card.label}
                            </div>
                            <div className="mt-2 text-lg font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
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
                                className="rounded-[22px] bg-white/78 px-4 py-4 text-sm leading-6 text-[color:var(--sg-text-strong)]"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                    {copy.severity[item.severity]}
                                </div>
                                <div className="mt-2 text-base font-semibold tracking-[-0.03em]">{item.title}</div>
                                <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">{item.body}</p>
                            </article>
                        ))}
                    </div>
                </DashboardCard>
            ) : null}
        </div>
    );
}
