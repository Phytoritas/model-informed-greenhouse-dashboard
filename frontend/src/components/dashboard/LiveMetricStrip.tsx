import type { KpiTileData } from '../KpiStrip';
import { formatMetricValue } from '../../utils/formatValue';
import { useLocale } from '../../i18n/LocaleProvider';
import DashboardCard from '../common/DashboardCard';
import TelemetryFreshnessChip from '../status/TelemetryFreshnessChip';
import { StatusChip } from '../ui/status-chip';
import { metricToneForTile, metricToneSurfaceClass } from '../../utils/metricTone';
import type { TelemetryStatus } from '../../types';

interface LiveMetricStripProps {
    statusSummary: string;
    telemetryStatus: TelemetryStatus;
    primaryTiles: KpiTileData[];
    secondaryTiles: KpiTileData[];
}

function MetricTile({
    tile,
    featured = false,
}: {
    tile: KpiTileData;
    featured?: boolean;
}) {
    const Icon = tile.icon;
    const value = typeof tile.value === 'number'
        ? formatMetricValue(tile.value, tile.fractionDigits)
        : tile.value;
    const isMissing = tile.availabilityState === 'missing';
    const tone = metricToneForTile(tile);
    const toneClass = metricToneSurfaceClass[tone];

    if (featured) {
        return (
            <div className={`sg-panel rounded-[var(--sg-radius-lg)] px-5 py-5 ${toneClass}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[var(--sg-radius-md)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <StatusChip tone={tone}>{tile.availabilityLabel}</StatusChip>
                </div>
                <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                    {tile.label}
                </div>
                <div className="mt-3 flex items-end gap-3">
                    <div className="sg-data-number text-[clamp(2.2rem,1.6rem+1.9vw,3.9rem)] font-semibold tracking-[-0.06em] text-[color:var(--sg-text-strong)]">
                        {value}
                    </div>
                    {!isMissing && typeof tile.value === 'number' ? (
                        <div className="pb-1 text-sm text-[color:var(--sg-text-muted)]">{tile.unit}</div>
                    ) : null}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="rounded-[var(--sg-radius-md)] bg-[color:var(--sg-surface-warm)] px-4 py-3 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                        {tile.trendDetail || tile.availabilityLabel}
                    </div>
                    {tile.lastReceived ? (
                        <div className="rounded-[var(--sg-radius-md)] bg-[color:var(--sg-surface-muted)] px-4 py-3 text-right text-[11px] leading-5 text-[color:var(--sg-text-faint)]">
                            {tile.lastReceived}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className={`sg-panel rounded-[var(--sg-radius-md)] px-4 py-4 ${toneClass}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <StatusChip tone={tone}>{tile.availabilityLabel}</StatusChip>
            </div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                {tile.label}
            </div>
            <div className="mt-2 flex items-end gap-2">
                <div className="sg-data-number text-[clamp(1.5rem,1rem+1vw,2.25rem)] font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                    {value}
                </div>
                {!isMissing && typeof tile.value === 'number' ? (
                    <div className="pb-1 text-sm text-[color:var(--sg-text-muted)]">{tile.unit}</div>
                ) : null}
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
                <div className="text-xs leading-5 text-[color:var(--sg-text-muted)]">{tile.trendDetail || tile.availabilityLabel}</div>
                {tile.lastReceived ? <div className="max-w-[8rem] text-right text-[11px] leading-5 text-[color:var(--sg-text-faint)]">{tile.lastReceived}</div> : null}
            </div>
        </div>
    );
}

export default function LiveMetricStrip({
    statusSummary,
    telemetryStatus,
    primaryTiles,
    secondaryTiles,
}: LiveMetricStripProps) {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            eyebrow: '실시간 기후',
            title: '실시간 기후와 생리 신호',
            highlight: '리드 신호',
            otherSignals: '보조 신호',
        }
        : {
            eyebrow: 'Live climate',
            title: 'Live climate and physiology signals',
            highlight: 'Lead signal',
            otherSignals: 'Supporting signals',
        };
    const featuredTile = primaryTiles[0] ?? secondaryTiles[0] ?? null;
    const tiles = [...primaryTiles, ...secondaryTiles]
        .filter((tile) => tile.key !== featuredTile?.key)
        .slice(0, 5);
    const supportingLeadTile = tiles[0] ?? null;
    const supportingTailTiles = supportingLeadTile
        ? tiles.filter((tile) => tile.key !== supportingLeadTile.key)
        : tiles;

    return (
        <DashboardCard
            variant="metric"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={statusSummary}
            actions={<TelemetryFreshnessChip status={telemetryStatus} />}
        >
            {featuredTile ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                    <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                            {copy.highlight}
                        </div>
                        <MetricTile tile={featuredTile} featured />
                    </div>
                    <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                            {copy.otherSignals}
                        </div>
                        <div className="grid gap-3">
                            {supportingLeadTile ? (
                                <MetricTile tile={supportingLeadTile} />
                            ) : null}
                            <div className="grid gap-3 md:grid-cols-2">
                                {supportingTailTiles.map((tile) => (
                                    <MetricTile key={tile.key} tile={tile} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {tiles.map((tile) => (
                        <MetricTile key={tile.key} tile={tile} />
                    ))}
                </div>
            )}
        </DashboardCard>
    );
}
