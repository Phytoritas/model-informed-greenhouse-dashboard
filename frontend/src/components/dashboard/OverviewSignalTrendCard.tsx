import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDateTime, formatLocaleTime } from '../../i18n/locale';
import type { OverviewSignalsPayload } from '../../types';
import { normalizeOverviewSourceSinkBalance } from '../../utils/sourceSinkBalance';
import ChartFrame from '../charts/ChartFrame';
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

  const copy = locale === 'ko'
    ? {
      eyebrow: '3일 시계열',
      title: '온실 내부 일사량 · 소스-싱크 균형 지수',
      description: '실제 API 이력에 실시간 소스-싱크 추세를 겹쳐 표시합니다.',
      irradiance: '온실 내부 일사량',
      balance: '소스-싱크 균형 지수',
      irradianceUnit: signals?.irradiance.unit ?? 'W/m²',
      balanceUnit: signals?.source_sink.unit ?? '정규 지수',
      loading: '실제 3일 추세를 불러오는 중입니다.',
      error: error ?? '실제 추세를 불러오지 못했습니다.',
      empty: '표시할 실제 추세가 아직 없습니다.',
      modelMissing: '모델 스냅샷 이력이 아직 없어 소스-싱크 추세를 표시할 수 없습니다.',
      mergedTitle: '온실 내부 일사량과 소스-싱크를 한 차트에서 봅니다.',
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
      loading: 'Loading the live 3-day trend.',
      error: error ?? 'Failed to load the live trend.',
      empty: 'No live trend is available yet.',
      modelMissing: 'Model snapshot history is not available yet for the source-sink trend.',
      mergedTitle: 'Greenhouse irradiance and source-sink are shown in one chart.',
      updated: 'Refreshed',
      staleWarning: 'The latest refresh is delayed, so the last successful trend is still shown.',
    };
  const irradianceUpdatedAt = refreshedAt ?? signals?.irradiance.source.fetched_at ?? null;

  const hasIrradiance = irradianceSeries.length >= 2;
  const hasSourceSink = sourceSinkSeries.length >= 2;
  const cardClassName = fillHeight ? 'h-full' : undefined;
  const chartCardClassName = fillHeight ? 'h-full !p-4' : '!p-4';

  if (loading && !signals) {
    return (
      <DashboardCard
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        className={cardClassName}
      >
        <div className="rounded-[18px] bg-white/76 px-4 py-5 text-sm text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
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
        <div className="rounded-[18px] bg-white/76 px-4 py-5 text-sm text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
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
        <div className="rounded-[18px] bg-white/76 px-4 py-5 text-sm text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
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
      <div className="rounded-[16px] bg-[color:var(--sg-surface-soft)] px-2.5 py-2.5" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold tracking-[0.06em] text-[color:var(--sg-text-faint)]">
          <div className="flex flex-wrap items-center gap-2">
            <span>{copy.mergedTitle}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-[#d26a2e]" />
              {copy.irradiance}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-[#8a3d4a]" />
              {copy.balance}
            </span>
          </div>
          {irradianceUpdatedAt ? (
            <span className="rounded-full bg-white/82 px-2 py-1 text-[10px] font-semibold text-[color:var(--sg-text-faint)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
              {copy.updated} {formatLocaleDateTime(locale, irradianceUpdatedAt, {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : null}
        </div>
        {error && signals ? (
          <div className="mb-2 rounded-[12px] bg-white/78 px-2.5 py-2 text-[11px] font-medium leading-4 text-[color:var(--sg-text-muted)]">
            {copy.staleWarning}
          </div>
        ) : null}
        {hasIrradiance ? (
          <ChartFrame minHeight={192} style={{ height: 192 }}>
            {({ width, height }) => (
              <LineChart
                width={Math.max(width, 1)}
                height={Math.max(height, 192)}
                data={combinedSeries}
                margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(123, 93, 78, 0.14)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value: number) => formatLocaleTime(locale, value, { month: '2-digit', day: '2-digit', hour: '2-digit' })}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  domain={[-1, 1]}
                  ticks={[-1, -0.5, 0, 0.5, 1]}
                />
                <ReferenceLine yAxisId="right" y={0} stroke="rgba(123, 93, 78, 0.4)" strokeDasharray="4 4" />
                <Tooltip
                  labelFormatter={(value: number) => formatLocaleTime(locale, value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  formatter={(value: number, name: string) => {
                    if (name === 'irradiance') {
                      return [`${value.toFixed(1)} ${copy.irradianceUnit}`, copy.irradiance];
                    }
                    return [`${value.toFixed(3)} ${copy.balanceUnit}`, copy.balance];
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 251, 246, 0.98)',
                    border: '1px solid rgba(123, 93, 78, 0.12)',
                    borderRadius: '12px',
                    boxShadow: '0 12px 28px rgba(90, 64, 63, 0.10)',
                    fontSize: '12px',
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="irradiance"
                  name="irradiance"
                  connectNulls
                  stroke="#d26a2e"
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sourceSinkBalance"
                  name="sourceSinkBalance"
                  connectNulls
                  stroke="#8a3d4a"
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            )}
          </ChartFrame>
        ) : (
          <div className="rounded-[14px] bg-white/78 px-2.5 py-3 text-[13px] text-[color:var(--sg-text-muted)]">
            {copy.empty}
          </div>
        )}
        {!hasSourceSink ? (
          <div className="mt-2 rounded-[14px] bg-white/78 px-2.5 py-2.5 text-[12px] leading-4 text-[color:var(--sg-text-muted)]">
            {copy.modelMissing}
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
