import type {
    AdvancedModelMetrics,
    CropType,
    ForecastData,
    ProducePricesPayload,
    RtrProfile,
    SensorData,
    TelemetryStatus,
    WeatherOutlook,
} from '../../types';
import type { SmartGrowKnowledgeSummary } from '../../hooks/useSmartGrowKnowledge';
import type { KpiTileData } from '../KpiStrip';
import DashboardCard from '../common/DashboardCard';
import AdvisorTabs from '../advisor/AdvisorTabs';
import AlertRail, { type AlertRailItem } from '../dashboard/AlertRail';
import LiveMetricStrip from '../dashboard/LiveMetricStrip';
import type { AlertHistoryEntry } from '../../hooks/useAlertHistory';

interface AlertsCommandCenterProps {
    locale: 'ko' | 'en';
    items: AlertRailItem[];
    crop: CropType;
    summary?: SmartGrowKnowledgeSummary | null;
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
    history?: SensorData[];
    forecast?: ForecastData | null;
    producePrices?: ProducePricesPayload | null;
    weather?: WeatherOutlook | null;
    rtrProfile?: RtrProfile | null;
    telemetryStatus: TelemetryStatus;
    statusSummary: string;
    primaryTiles: KpiTileData[];
    secondaryTiles: KpiTileData[];
    activePanel?: 'alerts-protection' | 'alerts-warning' | 'alerts-history';
    historyItems?: AlertHistoryEntry[];
    historyLoading?: boolean;
    historyError?: string | null;
}

type AlertSeverity = AlertRailItem['severity'];

const SEVERITY_BAR_CLASS: Record<AlertSeverity, string> = {
    critical: 'bg-[color:var(--sg-color-primary)]',
    warning: 'bg-[color:var(--sg-accent-amber)]',
    info: 'bg-[color:var(--sg-color-olive)]',
    resolved: 'bg-[color:var(--sg-color-sage)]',
};

function SeverityTimeline({
    items,
    label,
    countLabel,
}: {
    items: Array<Pick<AlertRailItem, 'id' | 'severity'>>;
    label: string;
    countLabel: string;
}) {
    const timelineItems = items.length
        ? items.slice(-10)
        : [
            { id: 'empty-a', severity: 'resolved' as const },
            { id: 'empty-b', severity: 'info' as const },
            { id: 'empty-c', severity: 'resolved' as const },
        ];

    return (
        <div className="mt-3 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white/65 px-2 py-2">
            <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-bold uppercase text-[color:var(--sg-text-faint)]">{label}</span>
                <span className="text-[10px] font-semibold text-[color:var(--sg-color-olive)]">{timelineItems.length} {countLabel}</span>
            </div>
            <div className="flex h-[42px] items-end gap-1" aria-hidden="true">
                {timelineItems.map((item, index) => (
                    <span
                        key={`${item.id}-${index}`}
                        className={`block flex-1 rounded-t-[5px] ${SEVERITY_BAR_CLASS[item.severity]}`}
                        style={{ height: `${item.severity === 'critical' ? 88 : item.severity === 'warning' ? 68 : item.severity === 'info' ? 48 : 34}%` }}
                    />
                ))}
            </div>
            <span className="sr-only">{label}</span>
        </div>
    );
}

export default function AlertsCommandCenter({
    locale,
    items,
    crop,
    summary = null,
    currentData,
    metrics,
    history = [],
    forecast = null,
    producePrices = null,
    weather = null,
    rtrProfile = null,
    telemetryStatus,
    statusSummary,
    primaryTiles,
    secondaryTiles,
    activePanel = 'alerts-protection',
    historyItems = [],
    historyLoading = false,
    historyError = null,
}: AlertsCommandCenterProps) {
    const copy = locale === 'ko'
        ? {
            eyebrow: '긴급 알림 요약',
            title: '긴급 알림과 확인 필요를 바로 가릅니다',
            description: '지금 확인할 항목과 최근 생성된 운영 메모를 한 화면에서 정리합니다.',
            critical: '긴급 알림',
            warning: '확인 필요',
            resolved: '처리 완료',
            next: '다음 확인',
            empty: '현재 바로 조치할 항목은 없습니다. 센서 신선도와 운영 메모만 유지 점검하세요.',
            historySource: '최근 처리 이력',
            historyDescription: '최근 알림 처리 이력을 시간순으로 정리합니다.',
            historyLoading: '처리 이력을 불러오는 중입니다.',
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
            description: 'Keep urgent checks, warnings, and recently generated operating notes in one page.',
            critical: 'Urgent',
            warning: 'Warning',
            resolved: 'Handled',
            next: 'Next check',
            empty: 'There is no urgent alert right now. Keep telemetry freshness and operating notes in view.',
            historySource: 'Backend history',
            historyDescription: 'Recent alert history persisted through /api/alerts/history.',
            historyLoading: 'Loading alert history...',
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
    const summaryCards = [
        {
            label: copy.critical,
            value: `${counts.critical}`,
            detail: leadItem?.severity === 'critical' ? leadItem.title : copy.empty,
            toneClass: 'bg-[color:var(--sg-accent-rose-soft)]',
            timelineItems: items.filter((item) => item.severity === 'critical'),
        },
        {
            label: copy.warning,
            value: `${counts.warning}`,
            detail: locale === 'ko' ? '결로·병해·센서 지연 같은 확인 항목입니다.' : 'Review condensation, disease, and delayed-sensor checks.',
            toneClass: 'sg-tint-amber',
            timelineItems: items.filter((item) => item.severity === 'warning'),
        },
        {
            label: copy.resolved,
            value: `${Math.max(counts.resolved, historyItems.length)}`,
            detail: copy.historyDescription,
            toneClass: 'sg-tint-neutral',
            timelineItems: historyItems.map((item) => ({ id: item.id, severity: item.severity })),
        },
        {
            label: copy.next,
            value: leadItem?.title ?? statusSummary,
            detail: leadItem?.body ?? copy.empty,
            toneClass: 'bg-white/86',
            timelineItems: items,
        },
    ];
    const resolvedItems = items.filter((item) => item.severity === 'resolved');
    const backendHistoryItems = historyItems.length
        ? historyItems
        : resolvedItems.map((item) => ({
            id: item.id,
            severity: item.severity,
            title: item.title,
            body: item.body,
            source: 'frontend-fallback',
        }));

    return (
        <div className="space-y-6">
            {activePanel === 'alerts-warning' ? (
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
                                className={`sg-panel px-4 py-4 ${card.toneClass}`}
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
                                <SeverityTimeline
                                    items={card.timelineItems}
                                    label={locale === 'ko' ? '상태 흐름' : 'Status timeline'}
                                    countLabel={locale === 'ko' ? '건' : 'events'}
                                />
                            </article>
                        ))}
                    </div>
                </DashboardCard>
            ) : null}

            {activePanel === 'alerts-protection' ? (
                <div className="grid gap-6">
                    <AdvisorTabs
                        key={`${crop}-pesticide`}
                        crop={crop}
                        summary={summary}
                        currentData={currentData}
                        metrics={metrics}
                        history={history}
                        forecast={forecast}
                        producePrices={producePrices}
                        weather={weather}
                        rtrProfile={rtrProfile}
                        isOpen
                        initialTab="pesticide"
                        onClose={() => undefined}
                        showCloseAction={false}
                    />
                </div>
            ) : null}
            {activePanel === 'alerts-warning' ? (
                <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.48fr)]">
                    <AlertRail items={items} />
                    <LiveMetricStrip
                        statusSummary={statusSummary}
                        telemetryStatus={telemetryStatus}
                        primaryTiles={primaryTiles}
                        secondaryTiles={secondaryTiles}
                    />
                </div>
            ) : null}
            {activePanel === 'alerts-history' ? (
                <DashboardCard
                    eyebrow={copy.resolved}
                    title={copy.historySource}
                    description={historyError ?? copy.historyDescription}
                >
                    <div className="grid gap-3">
                        {historyLoading ? (
                            <div className="sg-panel px-4 py-4 text-sm text-[color:var(--sg-text-muted)]">
                                {copy.historyLoading}
                            </div>
                        ) : null}
                        {(backendHistoryItems.length ? backendHistoryItems : items.slice(0, 3)).map((item) => (
                            <article
                                key={item.id}
                                className="sg-panel px-4 py-4 text-sm leading-6 text-[color:var(--sg-text-strong)]"
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
