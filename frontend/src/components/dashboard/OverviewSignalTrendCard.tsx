import { useMemo } from 'react';
import {
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDateTime } from '../../i18n/locale';
import type { OverviewSignalsPayload } from '../../types';
import { normalizeOverviewSourceSinkBalance } from '../../utils/sourceSinkBalance';
import ChartFrame, { ChartSeriesLegend } from '../charts/ChartFrame';
import ScientificText from '../common/ScientificText';
import {
  buildTimeAxisPlan,
  chartSeries,
  DASHBOARD_CHART_ANNOTATION,
  DASHBOARD_CHART_AXIS_PROPS,
  DASHBOARD_CHART_AXIS_STROKE,
  DASHBOARD_CHART_CURSOR,
  DASHBOARD_CHART_HEIGHT,
  DASHBOARD_CHART_LEGEND_CLASSNAME,
  DASHBOARD_CHART_RULE_STROKE,
  DASHBOARD_CHART_TOOLTIP_ITEM_STYLE,
  DASHBOARD_CHART_TOOLTIP_LABEL_STYLE,
  DASHBOARD_CHART_TOOLTIP_STYLE,
  formatTimeAxisLabel,
  formatTimeAxisTick,
  seriesLineProps,
} from '../charts/chartStyles';
import DashboardCard from '../common/DashboardCard';

interface OverviewSignalTrendCardProps {
  signals: OverviewSignalsPayload | null;
  loading: boolean;
  error: string | null;
  refreshedAt?: number | null;
  fillHeight?: boolean;
  liveSourceSinkSeries?: Array<{
    timestamp: number;
    value: number;
  }>;
  /** Replay cursor shared with the 3D twin; null keeps the live view. */
  selectedTimestamp?: number | null;
}

interface ChartPoint {
  timestamp: number;
  value: number;
}

interface CombinedChartPoint {
  timestamp: number;
  irradiance: number | null;
  sourceSinkBalance: number | null;
}

/** Irradiance uses the first cycle color; the balance index uses the fourth. */
const IRRADIANCE_SERIES_INDEX = 0;
const BALANCE_SERIES_INDEX = 3;

function buildChartPoints<T extends { time: string }>(
  points: T[],
  readValue: (point: T) => number,
): ChartPoint[] {
  return points
    .map((point) => ({
      timestamp: new Date(point.time).getTime(),
      value: Number(readValue(point)),
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value));
}

function buildCombinedSeries(
  irradianceSeries: ChartPoint[],
  sourceSinkSeries: ChartPoint[],
): CombinedChartPoint[] {
  const seriesMap = new Map<number, CombinedChartPoint>();

  irradianceSeries.forEach((point) => {
    seriesMap.set(point.timestamp, {
      timestamp: point.timestamp,
      irradiance: point.value,
      sourceSinkBalance: seriesMap.get(point.timestamp)?.sourceSinkBalance ?? null,
    });
  });

  sourceSinkSeries.forEach((point) => {
    const existing = seriesMap.get(point.timestamp);
    seriesMap.set(point.timestamp, {
      timestamp: point.timestamp,
      irradiance: existing?.irradiance ?? null,
      sourceSinkBalance: point.value,
    });
  });

  return [...seriesMap.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function mergeLiveSourceSinkSeries(
  sourceSinkSeries: ChartPoint[],
  liveSourceSinkSeries: OverviewSignalTrendCardProps['liveSourceSinkSeries'],
): ChartPoint[] {
  if (!liveSourceSinkSeries?.length) {
    return sourceSinkSeries;
  }

  const seriesMap = new Map<number, ChartPoint>();
  sourceSinkSeries.forEach((point) => {
    seriesMap.set(point.timestamp, point);
  });
  liveSourceSinkSeries.forEach((point) => {
    const timestamp = Number(point.timestamp);
    const value = Number(point.value);
    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) {
      return;
    }
    seriesMap.set(timestamp, { timestamp, value });
  });
  return [...seriesMap.values()].sort((left, right) => left.timestamp - right.timestamp);
}

export default function OverviewSignalTrendCard({
  signals,
  loading,
  error,
  refreshedAt = null,
  fillHeight = true,
  liveSourceSinkSeries = [],
  selectedTimestamp = null,
}: OverviewSignalTrendCardProps) {
  const { locale } = useLocale();
  const irradianceSeries = useMemo(
    () => buildChartPoints(signals?.irradiance.points ?? [], (point) => point.shortwave_radiation_w_m2),
    [signals],
  );
  const sourceSinkSeries = useMemo(() => (
    mergeLiveSourceSinkSeries(
      buildChartPoints(
        signals?.source_sink.points ?? [],
        (point) => normalizeOverviewSourceSinkBalance(point),
      ),
      liveSourceSinkSeries,
    )
  ), [liveSourceSinkSeries, signals]);
  const combinedSeries = useMemo(
    () => buildCombinedSeries(irradianceSeries, sourceSinkSeries),
    [irradianceSeries, sourceSinkSeries],
  );
  const axisPlan = useMemo(
    () => buildTimeAxisPlan(combinedSeries.map((point) => point.timestamp)),
    [combinedSeries],
  );
  const multiDay = axisPlan?.multiDay ?? false;

  const copy = locale === 'ko'
    ? {
      eyebrow: '3일 시계열',
      title: '온실 내부 일사량 · 소스-싱크 균형 지수',
      description: '실제 API 이력에 실시간 소스-싱크 추세를 겹쳐 표시합니다.',
      irradiance: '온실 내부 일사량',
      balance: '소스-싱크 균형 지수',
      irradianceUnit: signals?.irradiance.unit ?? 'W/m²',
      balanceUnit: signals?.source_sink.unit ?? '정규 지수',
      axisLeft: '왼쪽 축',
      axisRight: '오른쪽 축',
      loading: '실제 3일 추세를 불러오는 중입니다.',
      error: error ?? '실제 추세를 불러오지 못했습니다.',
      empty: '표시할 실제 추세가 아직 없습니다.',
      modelMissing: '모델 스냅샷 이력이 아직 없어 소스-싱크 추세를 표시할 수 없습니다.',
      axisNote: '두 지표는 단위가 달라 왼쪽·오른쪽 축을 따로 사용합니다.',
      updated: '화면 갱신',
      staleWarning: '최근 갱신 요청이 지연되어 마지막 성공 값을 유지하고 있습니다.',
    }
    : {
      eyebrow: '3-day trend',
      title: 'Greenhouse irradiance · source-sink balance',
      description: 'Live source-sink telemetry is overlaid on the API history.',
      irradiance: 'Greenhouse irradiance',
      balance: 'Source-sink balance',
      irradianceUnit: signals?.irradiance.unit ?? 'W/m²',
      balanceUnit: signals?.source_sink.unit ?? 'normalized index',
      axisLeft: 'Left axis',
      axisRight: 'Right axis',
      loading: 'Loading the live 3-day trend.',
      error: error ?? 'Failed to load the live trend.',
      empty: 'No live trend is available yet.',
      modelMissing: 'Model snapshot history is not available yet for the source-sink trend.',
      axisNote: 'The two signals use different units, so each keeps its own labeled axis.',
      updated: 'Refreshed',
      staleWarning: 'The latest refresh is delayed, so the last successful trend is still shown.',
    };
  const irradianceUpdatedAt = refreshedAt ?? signals?.irradiance.source.fetched_at ?? null;

  const hasIrradiance = irradianceSeries.length >= 2;
  const hasSourceSink = sourceSinkSeries.length >= 2;
  const hasCursor = typeof selectedTimestamp === 'number' && Number.isFinite(selectedTimestamp);
  const cardClassName = fillHeight ? 'sg-panel h-full min-w-0 bg-white' : 'sg-panel min-w-0 bg-white';
  const chartCardClassName = fillHeight ? 'sg-panel h-full min-w-0 bg-white !p-4' : 'sg-panel min-w-0 bg-white !p-4';
  const chartHeight = DASHBOARD_CHART_HEIGHT.compact;

  if (loading && !signals) {
    return (
      <DashboardCard
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        className={cardClassName}
      >
        <div className="sg-panel bg-white px-4 py-5 text-sm text-[color:var(--sg-text-muted)]">
          {copy.loading}
        </div>
      </DashboardCard>
    );
  }

  if (error && !signals) {
    return (
      <DashboardCard
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        className={cardClassName}
      >
        <div className="sg-panel bg-white px-4 py-5 text-sm text-[color:var(--sg-text-muted)]">
          {copy.error}
        </div>
      </DashboardCard>
    );
  }

  if (!hasIrradiance && !hasSourceSink) {
    return (
      <DashboardCard
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        className={cardClassName}
      >
        <div className="sg-panel bg-white px-4 py-5 text-sm text-[color:var(--sg-text-muted)]">
          {copy.empty}
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      contentClassName="flex flex-col gap-2"
      className={chartCardClassName}
    >
      <div className="min-w-0 rounded-[var(--sg-radius-sm)] bg-white px-2.5 py-2.5">
        {/* Both units read horizontally here, tagged left/right, instead of as
            rotated axis titles that ate plot width on each side. */}
        <p className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-[color:var(--sg-text-muted)]">
          <span className="inline-flex items-baseline gap-1">
            {copy.axisLeft}
            <ScientificText text={copy.irradianceUnit} className="scientific-unit" />
          </span>
          <span className="inline-flex items-baseline gap-1">
            {copy.axisRight}
            <ScientificText text={copy.balanceUnit} className="scientific-unit" />
          </span>
        </p>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <ChartSeriesLegend
            entries={[
              { label: copy.irradiance, seriesIndex: IRRADIANCE_SERIES_INDEX },
              { label: copy.balance, seriesIndex: BALANCE_SERIES_INDEX },
            ]}
          />
          {irradianceUpdatedAt ? (
            <span className={`${DASHBOARD_CHART_LEGEND_CLASSNAME} text-[color:var(--sg-text-faint)]`}>
              {copy.updated} {formatLocaleDateTime(locale, irradianceUpdatedAt, {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : null}
        </div>
        <p className="mb-2 text-[11px] leading-4 text-[color:var(--sg-text-muted)]">{copy.axisNote}</p>
        {error && signals ? (
          <div className="mb-2 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)] px-2.5 py-2 text-[11px] font-medium leading-4 text-[color:var(--sg-text-muted)]">
            {copy.staleWarning}
          </div>
        ) : null}
        {hasIrradiance ? (
          <ChartFrame minHeight={chartHeight} style={{ height: chartHeight }}>
            {({ width, height }) => (
              <LineChart
                width={Math.max(width, 1)}
                height={Math.max(height, chartHeight)}
                data={combinedSeries}
                margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
              >
                <XAxis
                  {...DASHBOARD_CHART_AXIS_PROPS}
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={axisPlan ? axisPlan.domain : ['dataMin', 'dataMax']}
                  ticks={axisPlan?.ticks}
                  tickFormatter={(value: number) => formatTimeAxisTick(locale, Number(value), multiDay)}
                  minTickGap={16}
                />
                <YAxis {...DASHBOARD_CHART_AXIS_PROPS} yAxisId="irradiance" width={46} />
                <YAxis
                  {...DASHBOARD_CHART_AXIS_PROPS}
                  yAxisId="balance"
                  orientation="right"
                  width={46}
                  domain={[-1, 1]}
                  ticks={[-1, -0.5, 0, 0.5, 1]}
                />
                <ReferenceLine yAxisId="balance" y={0} stroke={DASHBOARD_CHART_RULE_STROKE} strokeDasharray="4 4" />
                {hasCursor ? (
                  <ReferenceLine
                    yAxisId="irradiance"
                    x={selectedTimestamp as number}
                    stroke={DASHBOARD_CHART_AXIS_STROKE}
                    strokeDasharray="4 4"
                    strokeWidth={1.2}
                    ifOverflow="extendDomain"
                    label={{
                      value: formatTimeAxisLabel(locale, selectedTimestamp as number),
                      position: 'top',
                      ...DASHBOARD_CHART_ANNOTATION,
                    }}
                  />
                ) : null}
                <Tooltip
                  cursor={DASHBOARD_CHART_CURSOR}
                  labelFormatter={(value: number) => formatTimeAxisLabel(locale, Number(value))}
                  formatter={(value: number, name: string) => {
                    if (name === 'irradiance') {
                      return [`${value.toFixed(1)} ${copy.irradianceUnit}`, copy.irradiance];
                    }
                    return [`${value.toFixed(3)} ${copy.balanceUnit}`, copy.balance];
                  }}
                  contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
                  labelStyle={DASHBOARD_CHART_TOOLTIP_LABEL_STYLE}
                  itemStyle={DASHBOARD_CHART_TOOLTIP_ITEM_STYLE}
                />
                <Line
                  {...seriesLineProps(IRRADIANCE_SERIES_INDEX)}
                  yAxisId="irradiance"
                  dataKey="irradiance"
                  name="irradiance"
                  activeDot={{
                    ...seriesLineProps(IRRADIANCE_SERIES_INDEX).activeDot,
                    fill: chartSeries(IRRADIANCE_SERIES_INDEX).fill,
                  }}
                />
                <Line
                  {...seriesLineProps(BALANCE_SERIES_INDEX)}
                  yAxisId="balance"
                  dataKey="sourceSinkBalance"
                  name="sourceSinkBalance"
                  activeDot={{
                    ...seriesLineProps(BALANCE_SERIES_INDEX).activeDot,
                    fill: chartSeries(BALANCE_SERIES_INDEX).fill,
                  }}
                />
              </LineChart>
            )}
          </ChartFrame>
        ) : (
          <div className="rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)] px-2.5 py-3 text-[13px] text-[color:var(--sg-text-muted)]">
            {copy.empty}
          </div>
        )}
        {!hasSourceSink ? (
          <div className="mt-2 rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)] px-2.5 py-2.5 text-[12px] leading-4 text-[color:var(--sg-text-muted)]">
            {copy.modelMissing}
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
