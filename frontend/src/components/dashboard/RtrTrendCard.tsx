import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleTime } from '../../i18n/locale';
import type { CropType, RtrProfile, SensorData } from '../../types';
import { buildRTRLiveSnapshot } from '../../utils/rtr';
import ChartFrame from '../charts/ChartFrame';
import {
  DASHBOARD_CHART_AXIS_STROKE,
  DASHBOARD_CHART_GRID_STROKE,
  DASHBOARD_CHART_LEGEND_CLASSNAME,
  DASHBOARD_CHART_TICK,
  DASHBOARD_CHART_TOOLTIP_STYLE,
} from '../charts/chartStyles';
import DashboardCard from '../common/DashboardCard';

interface RtrTrendCardProps {
  crop: CropType;
  currentData: SensorData;
  history: SensorData[];
  profile?: RtrProfile | null;
  variant?: 'default' | 'chart-slot';
}

interface RtrTrendPoint {
  timestamp: number;
  actualTempC: number;
  targetTempC: number;
}

const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
const MAX_POINTS = 72;
const RTR_TREND_CARD_HEIGHT_CLASS = 'sg-panel h-[312px] min-w-0 overflow-hidden bg-white !p-4';

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
}: RtrTrendCardProps) {
  const { locale } = useLocale();
  const cardClassName = variant === 'chart-slot'
    ? 'sg-panel h-full min-h-[268px] min-w-0 overflow-hidden bg-white !p-4'
    : RTR_TREND_CARD_HEIGHT_CLASS;
  const chartHeight = variant === 'chart-slot' ? 176 : 176;
  const trendSeries = useMemo(
    () => buildRtrTrendSeries(crop, currentData, history, profile),
    [crop, currentData, history, profile],
  );

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

  if (trendSeries.length < 2) {
    return (
      <DashboardCard
        className={cardClassName}
        eyebrow={copy.eyebrow}
        title={copy.title}
        description=""
      >
        <div className="sg-panel bg-white px-4 py-5 text-sm text-[color:var(--sg-text-muted)]">
          {copy.waiting}
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      className={cardClassName}
      eyebrow={copy.eyebrow}
      title={copy.title}
      description=""
      contentClassName="flex flex-col gap-2"
    >
      <div className={DASHBOARD_CHART_LEGEND_CLASSNAME}>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-[color:var(--sg-color-olive)]" />
          {copy.actual}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-[color:var(--sg-color-terracotta)]" />
          {copy.target}
        </span>
      </div>

      <ChartFrame minHeight={chartHeight} style={{ height: chartHeight }}>
        {({ width, height }) => (
          <LineChart
            width={Math.max(width, 1)}
            height={Math.max(height, chartHeight)}
            data={trendSeries}
            margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={DASHBOARD_CHART_GRID_STROKE} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value: number) => formatLocaleTime(locale, value, { month: '2-digit', day: '2-digit', hour: '2-digit' })}
              stroke={DASHBOARD_CHART_AXIS_STROKE}
              tick={DASHBOARD_CHART_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={26}
            />
            <YAxis
              stroke={DASHBOARD_CHART_AXIS_STROKE}
              tick={DASHBOARD_CHART_TICK}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              labelFormatter={(value: number) => formatLocaleTime(locale, value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              formatter={(value: number) => `${value.toFixed(2)}°C`}
              contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
            />
            <Line
              type="monotone"
              dataKey="actualTempC"
              stroke="var(--sg-color-olive)"
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="targetTempC"
              stroke="var(--sg-color-terracotta)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ChartFrame>
    </DashboardCard>
  );
}
