import { Calendar, Droplets, Leaf, Zap } from 'lucide-react';
import { Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { CropType, ForecastData } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { UNIT_LABELS, getCropLabel, getForecastTitle } from '../utils/displayCopy';
import DashboardCard from './common/DashboardCard';
import ScientificText from './common/ScientificText';
import ChartFrame from './charts/ChartFrame';
import { DASHBOARD_CHART_AXIS_PROPS, DASHBOARD_CHART_MARGIN, DASHBOARD_CHART_TOOLTIP_STYLE, seriesBarProps } from './charts/chartStyles';
import { StatusChip } from './ui/status-chip';

interface ForecastPanelProps {
    forecast: ForecastData | null;
    crop: CropType;
}

type HarvestBasis = 'fresh' | 'dry' | 'none';

function isFiniteNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/** Read a named physical quantity without substituting another mass balance. */
function readOptionalNumber(source: unknown, keys: readonly string[]): number | null {
    if (!source || typeof source !== 'object') {
        return null;
    }
    const record = source as Record<string, unknown>;
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
    }
    return null;
}

const TOTAL_DRY_KEYS = [
    'total_fruit_growth_dry_kg',
] as const;

const DAILY_DRY_KEYS = [
    'fruit_growth_dry_kg',
] as const;

function ForecastMetricTile({
    icon: Icon,
    label,
    value,
    unit,
    body,
    tone,
}: {
    icon: typeof Leaf;
    label: string;
    value: string;
    unit: string;
    body: string;
    tone: 'green' | 'blue' | 'amber';
}) {
    const toneClass = {
        green: 'sg-tint-green text-[color:var(--sg-accent-forest)]',
        blue: 'sg-tint-blue text-[color:var(--sg-accent-blue)]',
        amber: 'sg-tint-amber text-[color:var(--sg-accent-amber)]',
    }[tone];

    return (
        <article
            className={`min-w-0 rounded-[var(--sg-radius-md)] px-3 py-2.5 ${toneClass}`}
            style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
            <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold leading-5 text-[color:var(--sg-text-muted)]">
                    {label}
                </span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-1.5 text-[color:var(--sg-text-strong)]">
                <span className="sg-data-number text-lg font-bold leading-none">{value}</span>
                {unit ? <ScientificText text={unit} className="scientific-unit text-xs font-medium text-[color:var(--sg-text-muted)]" /> : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                {body}
            </p>
        </article>
    );
}

const ForecastPanel = ({ forecast, crop }: ForecastPanelProps) => {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            eyebrow: '생육 전망',
            title: '7일 수확 · 증산 · 에너지 예측',
            subtitle: '오늘 이후 7일 동안의 수확 리듬과 물·에너지 부담을 한 카드에서 봅니다.',
            waiting: '예측 데이터를 불러오는 중입니다...',
            noHarvest: '가까운 수확 없음',
            noHarvestDescription: '현재 생육 단계 기준으로 다음 7일 안에는 수확이 잡히지 않았습니다.',
            leadTitle: '이번 주 운영 흐름',
            leadWithHarvest: '수확과 증산, 에너지 부담을 함께 보며 작업 리듬을 조정해야 합니다.',
            leadWithoutHarvest: '수확은 아직 멀지만 증산과 에너지 흐름은 계속 관리해야 합니다.',
            forecastDays: '예측 일수',
            yield: '7일 수확량',
            transpiration: '누적 증산량',
            energyUse: '누적 에너지',
            yieldBody: '다음 7일 동안 예상되는 총 수확량입니다.',
            transpirationBody: '물 사용 압력과 관수 템포를 함께 읽습니다.',
            energyBody: '난방·환기·냉방 부담을 합친 총량입니다.',
            chartTitle: '일별 수확과 증산 리듬',
            chartBody: '수확 시점과 물 사용 피크가 겹치는 구간을 먼저 확인합니다.',
            harvestYield: '일별 수확량',
            cropTranspiration: '일별 증산량',
            noDataBody: '예측이 아직 준비되지 않았습니다.',
            dryYield: '7일 과실 건물 증가량(모델)',
            dryYieldBody: '생과 수확량이 확정되지 않아 모델이 계산한 과실 건물중 증가량을 표시합니다.',
            dryLead: '생과 수확량 미확정',
            dryLeadDescription: '아직 생과 기준 수확량이 확정되지 않아, 과실 건물 증가량으로 이번 주 생산 흐름을 읽습니다.',
            unknownYield: '수확 예측 없음',
            unknownYieldBody: '수확량과 과실 건물 증가량 모두 계산되지 않았습니다.',
            energyUnknown: '계산 안 됨',
            energyUnknownBody: '에너지 사용량은 이번 예측에서 계산되지 않았습니다.',
            dryHarvestSeries: '일별 과실 건물 증가량',
            transpirationUnknownBody: '증산량은 이번 예측에서 계산되지 않았습니다.',
            refreshFailed: '예측 갱신 실패',
            staleResult: '아래 값은 마지막으로 성공한 예측이며 최신 상태가 아닙니다.',
            unavailable: '예측을 사용할 수 없습니다',
            unavailableBody: '이번 예측 데이터가 비어 있거나 유효하지 않아 값을 표시하지 않습니다.',
            refreshedAt: '마지막 갱신',
        }
        : {
            eyebrow: 'Growth outlook',
            title: '7-day harvest, transpiration, and energy forecast',
            subtitle: 'A compact view of harvest rhythm, water demand, and energy burden for the next week.',
            waiting: 'Waiting for forecast data...',
            noHarvest: 'No near-term harvest',
            noHarvestDescription: 'No harvest is expected within the next 7 days at the current growth stage.',
            leadTitle: 'This week’s operating rhythm',
            leadWithHarvest: 'Harvest, transpiration, and energy should be read together before setting work pace.',
            leadWithoutHarvest: 'Harvest is not imminent, but water and energy burden still need steady attention.',
            forecastDays: 'Forecast days',
            yield: '7-day yield',
            transpiration: 'Cumulative transpiration',
            energyUse: 'Cumulative energy',
            yieldBody: 'Projected total harvest across the next 7 days.',
            transpirationBody: 'Read irrigation pressure and water pace together.',
            energyBody: 'Combined heating, vent, and cooling burden.',
            chartTitle: 'Daily harvest and transpiration rhythm',
            chartBody: 'Check where harvest timing and water-use peaks overlap.',
            harvestYield: 'Daily harvest',
            cropTranspiration: 'Daily transpiration',
            noDataBody: 'Forecast data is not available yet.',
            dryYield: '7-day fruit dry-matter gain (model)',
            dryYieldBody: 'Fresh harvest is not resolved, so the model’s fruit dry-mass gain is shown instead.',
            dryLead: 'Fresh harvest not resolved',
            dryLeadDescription: 'Fresh-weight harvest is not resolved yet, so read this week from modelled fruit dry-matter gain.',
            unknownYield: 'No harvest projection',
            unknownYieldBody: 'Neither fresh harvest nor fruit dry-matter gain was computed.',
            energyUnknown: 'Not computed',
            energyUnknownBody: 'Energy use was not computed for this forecast.',
            dryHarvestSeries: 'Daily fruit dry-matter gain',
            transpirationUnknownBody: 'Transpiration was not computed for this forecast.',
            refreshFailed: 'Forecast refresh failed',
            staleResult: 'The values below come from the last successful forecast and are not current.',
            unavailable: 'Forecast unavailable',
            unavailableBody: 'This forecast payload is empty or invalid, so no values are shown.',
            refreshedAt: 'Last refreshed',
        };

    const refreshError = forecast && typeof forecast.refresh_error === 'string' && forecast.refresh_error.trim()
        ? forecast.refresh_error.trim()
        : null;
    const refreshedAt = forecast && typeof forecast.refreshed_at === 'string' && forecast.refreshed_at.trim()
        ? forecast.refreshed_at.trim()
        : null;

    if (!forecast || !forecast.daily || forecast.daily.length === 0) {
        return (
            <DashboardCard
                eyebrow={copy.eyebrow}
                title={copy.title}
                description={copy.subtitle}
                className="sg-tint-neutral"
                variant="empty"
            >
                <div
                    className="rounded-[28px] bg-white/84 px-5 py-12 text-center"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    <Calendar className="mx-auto h-10 w-10 text-[color:var(--sg-text-faint)]" />
                    <p className="mt-4 text-sm font-medium text-[color:var(--sg-text-strong)]">
                        {refreshError ? copy.unavailable : copy.waiting}
                    </p>
                    <p className="mt-2 text-xs text-[color:var(--sg-text-muted)]">
                        {refreshError ? copy.unavailableBody : copy.noDataBody}
                    </p>
                    {refreshError ? (
                        <p
                            role="alert"
                            className="mx-auto mt-3 max-w-[520px] rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-status-offline-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--sg-status-offline-text)]"
                        >
                            {copy.refreshFailed}: {refreshError}
                        </p>
                    ) : null}
                </div>
            </DashboardCard>
        );
    }

    const freshTotal = isFiniteNumber(forecast.total_harvest_kg) ? forecast.total_harvest_kg : null;
    const dryTotal = readOptionalNumber(forecast, TOTAL_DRY_KEYS);
    const energyTotal = isFiniteNumber(forecast.total_energy_kWh) ? forecast.total_energy_kWh : null;
    const transpirationTotal = isFiniteNumber(forecast.total_ETc_mm) ? forecast.total_ETc_mm : null;
    const dailyDryKey = DAILY_DRY_KEYS.find((key) => forecast.daily.some(
        (day) => readOptionalNumber(day, [key]) !== null,
    )) ?? DAILY_DRY_KEYS[0];

    const harvestBasis: HarvestBasis = freshTotal !== null
        ? 'fresh'
        : dryTotal !== null
            ? 'dry'
            : 'none';
    const hasHarvest = freshTotal !== null && freshTotal > 0.001;

    let yieldTileLabel = copy.yield;
    let yieldTileBody = copy.unknownYieldBody;
    let yieldTileValue = copy.unknownYield;
    let yieldTileUnit = '';
    let leadValue = copy.unknownYield;
    let leadNarrative = copy.unknownYieldBody;

    if (freshTotal !== null) {
        yieldTileBody = copy.yieldBody;
        yieldTileValue = freshTotal.toFixed(1);
        yieldTileUnit = UNIT_LABELS.weeklyYield;
        leadValue = hasHarvest ? `${freshTotal.toFixed(1)} ${UNIT_LABELS.weeklyYield}` : copy.noHarvest;
        leadNarrative = hasHarvest ? copy.leadWithHarvest : copy.noHarvestDescription;
    } else if (dryTotal !== null) {
        yieldTileLabel = copy.dryYield;
        yieldTileBody = copy.dryYieldBody;
        yieldTileValue = dryTotal.toFixed(2);
        yieldTileUnit = UNIT_LABELS.weeklyYield;
        leadValue = `${dryTotal.toFixed(2)} ${UNIT_LABELS.weeklyYield} · ${copy.dryLead}`;
        leadNarrative = copy.dryLeadDescription;
    }

    const energyValue = energyTotal !== null ? energyTotal.toFixed(1) : copy.energyUnknown;
    const energyUnit = energyTotal !== null ? UNIT_LABELS.energyUse : '';
    const energyBody = energyTotal !== null ? copy.energyBody : copy.energyUnknownBody;
    const energySummary = energyTotal !== null
        ? `${energyTotal.toFixed(1)} ${UNIT_LABELS.energyUse}`
        : `${copy.energyUse} ${copy.energyUnknown}`;

    const transpirationValue = transpirationTotal !== null
        ? transpirationTotal.toFixed(1)
        : copy.energyUnknown;
    const transpirationUnit = transpirationTotal !== null ? UNIT_LABELS.transpirationDepth : '';
    const transpirationBody = transpirationTotal !== null
        ? copy.transpirationBody
        : copy.transpirationUnknownBody;
    const transpirationSummary = transpirationTotal !== null
        ? `${transpirationTotal.toFixed(1)} ${UNIT_LABELS.transpirationDepth}`
        : `${copy.transpiration} ${copy.energyUnknown}`;

    const harvestSeriesKey = harvestBasis === 'dry' ? dailyDryKey : 'harvest_kg';
    const harvestSeriesName = harvestBasis === 'dry' ? copy.dryHarvestSeries : copy.harvestYield;

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.subtitle}
            className="sg-tint-green"
            actions={(
                <StatusChip tone="growth">
                    {cropLabel} · {forecast.daily.length} {copy.forecastDays}
                </StatusChip>
            )}
        >
            <div className="flex flex-col gap-3">
                {refreshError ? (
                    <section
                        role="alert"
                        className="rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-status-offline-text)]/30 bg-[color:var(--sg-status-offline-bg)] px-4 py-3"
                    >
                        <p className="text-sm font-bold text-[color:var(--sg-status-offline-text)]">
                            {copy.refreshFailed}: {refreshError}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--sg-status-offline-text)]">
                            {copy.staleResult}
                            {refreshedAt ? ` (${copy.refreshedAt}: ${refreshedAt})` : ''}
                        </p>
                    </section>
                ) : null}
                <section
                    className="rounded-[var(--sg-radius-lg)] bg-white/78 px-4 py-3"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="sg-eyebrow">{copy.leadTitle}</span>
                            <span className="sg-data-number text-lg font-bold leading-none text-[color:var(--sg-text-strong)]">
                                {leadValue}
                            </span>
                        </div>
                        <div className="text-xs leading-5 text-[color:var(--sg-text-muted)] sm:text-right">
                            {getForecastTitle(crop, locale)} · {transpirationSummary} · {energySummary}
                        </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                        {leadNarrative}
                    </p>
                </section>

                <div className="grid gap-2 md:grid-cols-3">
                    <ForecastMetricTile
                        icon={Leaf}
                        label={yieldTileLabel}
                        value={yieldTileValue}
                        unit={yieldTileUnit}
                        body={yieldTileBody}
                        tone="green"
                    />
                    <ForecastMetricTile
                        icon={Droplets}
                        label={copy.transpiration}
                        value={transpirationValue}
                        unit={transpirationUnit}
                        body={transpirationBody}
                        tone="blue"
                    />
                    <ForecastMetricTile
                        icon={Zap}
                        label={copy.energyUse}
                        value={energyValue}
                        unit={energyUnit}
                        body={energyBody}
                        tone="amber"
                    />
                </div>

                <section
                    className="rounded-[var(--sg-radius-lg)] bg-white/84 px-4 py-3"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="sg-eyebrow">{copy.chartTitle}</div>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                                {copy.chartBody}
                            </p>
                        </div>
                        <StatusChip tone="growth">
                            {forecast.daily.length} {copy.forecastDays}
                        </StatusChip>
                    </div>

                    <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-2">
                      {[
                        { key: harvestSeriesKey, name: harvestSeriesName, unit: harvestBasis === 'dry' ? 'kg DW' : 'kg', series: 0 },
                        { key: 'ETc_mm', name: copy.cropTranspiration, unit: 'mm', series: 1 },
                      ].map(series => (
                        <div key={series.key} className="min-w-0">
                        <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{series.name}</h4>
                        <ScientificText text={series.unit} className="scientific-unit mb-2 mt-1 block text-xs text-[color:var(--sg-text-muted)]" />
                        <ChartFrame className="h-64 w-full" minHeight={256}>
                            {({ width, height }) => (
                                <BarChart
                                    width={Math.max(width, 1)}
                                    height={Math.max(height, 256)}
                                    data={forecast.daily}
                                    margin={DASHBOARD_CHART_MARGIN}
                                >
                                    <XAxis
                                        {...DASHBOARD_CHART_AXIS_PROPS}
                                        dataKey="date"
                                        tickFormatter={(value: string) => value.split('-').slice(1).join('/')}
                                    />
                                    <YAxis {...DASHBOARD_CHART_AXIS_PROPS} width={44} />
                                    <Tooltip
                                        contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
                                        cursor={{ fill: 'var(--sg-color-sage-soft)' }}
                                        formatter={(value: number, name: string) => [
                                            typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)} ${series.unit}` : '-',
                                            name,
                                        ]}
                                    />
                                    <Bar
                                        dataKey={series.key}
                                        name={series.name}
                                        {...seriesBarProps(series.series)}
                                    />
                                </BarChart>
                            )}
                        </ChartFrame>
                        </div>
                      ))}
                    </div>
                </section>
            </div>
        </DashboardCard>
    );
};

export default ForecastPanel;
