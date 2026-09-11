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
import type { CropType, RtrProfile, SensorData } from '../../types';
import { buildRTRLiveSnapshot } from '../../utils/rtr';
import ChartFrame, { ChartSeriesLegend } from '../charts/ChartFrame';
import {
  buildTimeAxisPlan,
  chartSeries,
  DASHBOARD_CHART_ANNOTATION,
  DASHBOARD_CHART_AXIS_PROPS,
  DASHBOARD_CHART_AXIS_STROKE,
  DASHBOARD_CHART_CURSOR,
  DASHBOARD_CHART_HEIGHT,
  DASHBOARD_CHART_TOOLTIP_ITEM_STYLE,
  DASHBOARD_CHART_TOOLTIP_LABEL_STYLE,
  DASHBOARD_CHART_TOOLTIP_STYLE,
  formatTimeAxisLabel,
  formatTimeAxisTick,
  seriesLineProps,
} from '../charts/chartStyles';
import DashboardCard from '../common/DashboardCard';
import ScientificText from '../common/ScientificText';

interface RtrTrendCardProps {
  crop: CropType;
  currentData: SensorData;
  history: SensorData[];
  profile?: RtrProfile | null;
  variant?: 'default' | 'chart-slot';
  /** Replay cursor shared with the 3D twin; null keeps the live view. */
  selectedTimestamp?: number | null;
}

interface RtrTrendPoint {
  timestamp: number;
  actualTempC: number;
  targetTempC: number;
}

const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
const MAX_POINTS = 72;
const RTR_TREND_CARD_HEIGHT_CLASS = 'sg-panel min-w-0 bg-white !p-4';
/** Measured mean uses the first cycle color; the RTR target uses the fourth. */
const ACTUAL_SERIES_INDEX = 0;
const TARGET_SERIES_INDEX = 3;

function downsampleSeries<T>(series: T[], maxPoints: number): T[] {
  if (series.length <= maxPoints) {
    return series;
  }
  const step = Math.ceil(series.length / maxPoints);
  return series.filter((_, index) => index % step === 0 || index === series.length - 1);
}

function buildRtrTrendSeries(
  crop: CropType,
  currentData: SensorData,
  history: SensorData[],
  profile?: RtrProfile | null,
): RtrTrendPoint[] {
  const source = history.length > 0 ? history : [currentData];
  const endTimestamp = source[source.length - 1]?.timestamp ?? currentData.timestamp;
  const recentPoints = source.filter((point) => point.timestamp >= endTimestamp - THREE_DAYS_MS);
  const scopedPoints = recentPoints.length > 0 ? recentPoints : source;
  const sampledPoints = downsampleSeries(scopedPoints, MAX_POINTS);

  return sampledPoints.map((point) => {
    const pointIndex = source.findIndex((candidate) => candidate.timestamp === point.timestamp);
    const snapshot = buildRTRLiveSnapshot(
      point,
      source.slice(0, Math.max(pointIndex + 1, 1)),
      crop,
      profile,
    );
    return {
      timestamp: point.timestamp,
      actualTempC: Number(snapshot.averageTempC.toFixed(2)),
      targetTempC: Number(snapshot.targetTempC.toFixed(2)),
    };
  });
}

export default function RtrTrendCard({
  crop,
  currentData,
  history,
  profile = null,
  variant = 'default',
  selectedTimestamp = null,
}: RtrTrendCardProps) {
  const { locale } = useLocale();
  // In the chart board this is one cell among the time-series charts: no card
  // border of its own, and the shared 14px card title instead of a local size
  // override that fought the global heading scale.
  const cardClassName = variant === 'chart-slot'
    ? 'flex h-full min-w-0 flex-col !rounded-none !border-0 bg-[color:var(--sg-surface-strong)] p-3 !shadow-none'
    : RTR_TREND_CARD_HEIGHT_CLASS;
  const chartHeight = variant === 'chart-slot' ? 168 : DASHBOARD_CHART_HEIGHT.compact;
  const trendSeries = useMemo(
    () => buildRtrTrendSeries(crop, currentData, history, profile),
    [crop, currentData, history, profile],
  );
  const axisPlan = useMemo(
    () => buildTimeAxisPlan(trendSeries.map((point) => point.timestamp)),
    [trendSeries],
  );
  const multiDay = axisPlan?.multiDay ?? false;
  const hasCursor = typeof selectedTimestamp === 'number' && Number.isFinite(selectedTimestamp);

  const copy = locale === 'ko'
    ? {
      eyebrow: 'RTR 추세선',
      title: '최근 3일 RTR 온도 추세',
      actual: '실제 평균온도',
      target: 'RTR 목표온도',
      waiting: 'RTR 추세선을 계산하는 중입니다.',
    }
    : {
      eyebrow: 'RTR trend',
      title: 'Last 3-day RTR temperature trend',
      actual: 'Actual mean temp',
      target: 'RTR target temp',
      waiting: 'RTR trendline is being prepared.',
    };

  const slotHeader = variant === 'chart-slot' ? (
    <div className="mb-2 min-h-[42px]">
      <h3 className="truncate text-sm font-semibold leading-5 text-[color:var(--sg-text-strong)]" title={copy.title}>{copy.title}</h3>
      <ScientificText text="°C" className="scientific-unit mt-0.5 block text-xs text-[color:var(--sg-text-muted)]" />
    </div>
  ) : null;

  if (trendSeries.length < 2) {
    return (
      <DashboardCard
        className={cardClassName}
        eyebrow={variant === 'chart-slot' ? undefined : copy.eyebrow}
        title={variant === 'chart-slot' ? undefined : copy.title}
        description=""
      >
        {slotHeader}
        <div className="px-1 py-5 text-sm text-[color:var(--sg-text-muted)]">
          {copy.waiting}
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      className={cardClassName}
      eyebrow={variant === 'chart-slot' ? undefined : copy.eyebrow}
      title={variant === 'chart-slot' ? undefined : copy.title}
      description=""
      contentClassName={variant === 'chart-slot' ? 'flex flex-col' : 'flex flex-col gap-2'}
    >
      {slotHeader ?? <ScientificText text="°C" className="scientific-unit -mt-1 block text-xs text-[color:var(--sg-text-muted)]" />}
      <div className={variant === 'chart-slot' ? 'mb-2 min-h-6' : undefined}>
        <ChartSeriesLegend
        entries={[
          { label: copy.actual, seriesIndex: ACTUAL_SERIES_INDEX },
          { label: copy.target, seriesIndex: TARGET_SERIES_INDEX },
        ]}
        />
      </div>

      <ChartFrame minHeight={chartHeight} style={{ height: chartHeight }}>
        {({ width, height }) => (
          <LineChart
            width={Math.max(width, 1)}
            height={Math.max(height, chartHeight)}
            data={trendSeries}
            margin={variant === 'chart-slot' ? { top: 4, right: 10, left: 0, bottom: 0 } : { top: 8, right: 12, left: 4, bottom: 4 }}
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
            <YAxis
              {...DASHBOARD_CHART_AXIS_PROPS}
              width={44}
              domain={['auto', 'auto']}
            />
            {hasCursor ? (
              <ReferenceLine
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
              formatter={(value: number, name: string) => [
                `${value.toFixed(2)} °C`,
                name === 'actualTempC' ? copy.actual : copy.target,
              ]}
              contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
              labelStyle={DASHBOARD_CHART_TOOLTIP_LABEL_STYLE}
              itemStyle={DASHBOARD_CHART_TOOLTIP_ITEM_STYLE}
            />
            <Line
              {...seriesLineProps(ACTUAL_SERIES_INDEX)}
              dataKey="actualTempC"
              name="actualTempC"
              activeDot={{
                ...seriesLineProps(ACTUAL_SERIES_INDEX).activeDot,
                fill: chartSeries(ACTUAL_SERIES_INDEX).fill,
              }}
            />
            <Line
              {...seriesLineProps(TARGET_SERIES_INDEX)}
              dataKey="targetTempC"
              name="targetTempC"
              activeDot={{
                ...seriesLineProps(TARGET_SERIES_INDEX).activeDot,
                fill: chartSeries(TARGET_SERIES_INDEX).fill,
              }}
            />
          </LineChart>
        )}
      </ChartFrame>
    </DashboardCard>
  );
}
