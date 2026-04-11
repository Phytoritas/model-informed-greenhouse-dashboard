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
import type { OverviewSignalsPayload } from '../../types';
import ChartFrame from '../charts/ChartFrame';
import DashboardCard from '../common/DashboardCard';

interface OverviewSignalTrendCardProps {
  signals: OverviewSignalsPayload | null;
  loading: boolean;
  error: string | null;
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

export default function OverviewSignalTrendCard({
  signals,
  loading,
  error,
}: OverviewSignalTrendCardProps) {
  const { locale } = useLocale();
  const irradianceSeries = useMemo(
    () => buildChartPoints(signals?.irradiance.points ?? [], (point) => point.shortwave_radiation_w_m2),
    [signals],
  );
  const sourceSinkSeries = useMemo(
    () => buildChartPoints(signals?.source_sink.points ?? [], (point) => point.source_sink_balance),
    [signals],
  );
  const combinedSeries = useMemo(
    () => buildCombinedSeries(irradianceSeries, sourceSinkSeries),
    [irradianceSeries, sourceSinkSeries],
  );

  const copy = locale === 'ko'
    ? {
      eyebrow: '3일 시계열',
      title: '외기 일사량 · 소스-싱크 균형 지수',
      description: '실제 API와 모델 스냅샷 이력만 표시합니다.',
      irradiance: '외기 일사량',
      balance: '소스-싱크 균형 지수',
      irradianceUnit: signals?.irradiance.unit ?? 'W/m²',
      balanceUnit: signals?.source_sink.unit ?? '지수',
      loading: '실제 3일 추세를 불러오는 중입니다.',
      error: error ?? '실제 추세를 불러오지 못했습니다.',
      empty: '표시할 실제 추세가 아직 없습니다.',
      modelMissing: '모델 스냅샷 이력이 아직 없어 소스-싱크 추세를 표시할 수 없습니다.',
      mergedTitle: '외기 일사량과 소스-싱크를 한 차트에서 봅니다.',
    }
    : {
      eyebrow: '3-day trend',
      title: 'Outside irradiance · source-sink balance',
      description: 'Only live API and model snapshot history are shown.',
      irradiance: 'Outside irradiance',
      balance: 'Source-sink balance',
      irradianceUnit: signals?.irradiance.unit ?? 'W/m²',
      balanceUnit: signals?.source_sink.unit ?? 'index',
      loading: 'Loading the live 3-day trend.',
      error: error ?? 'Failed to load the live trend.',
      empty: 'No live trend is available yet.',
      modelMissing: 'Model snapshot history is not available yet for the source-sink trend.',
      mergedTitle: 'Outside irradiance and source-sink are shown in one chart.',
    };

  const latestIrradiance = irradianceSeries[irradianceSeries.length - 1] ?? null;
  const latestSourceSink = sourceSinkSeries[sourceSinkSeries.length - 1] ?? null;
  const hasIrradiance = irradianceSeries.length >= 2;
  const hasSourceSink = sourceSinkSeries.length >= 2;

  if (loading && !signals) {
    return (
      <DashboardCard eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
        <div className="rounded-[18px] bg-white/76 px-4 py-5 text-sm text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
          {copy.loading}
        </div>
      </DashboardCard>
    );
  }

  if (error && !signals) {
    return (
      <DashboardCard eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
        <div className="rounded-[18px] bg-white/76 px-4 py-5 text-sm text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
          {copy.error}
        </div>
      </DashboardCard>
    );
  }

  if (!hasIrradiance && !hasSourceSink) {
    return (
      <DashboardCard eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
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
      contentClassName="flex flex-col gap-4"
      className="h-full"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] bg-white/82 px-4 py-3" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
            {copy.irradiance}
          </div>
          <div className="mt-2 text-xl font-semibold leading-none tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
            {latestIrradiance ? `${latestIrradiance.value.toFixed(1)} ${copy.irradianceUnit}` : '-'}
          </div>
        </div>
        <div className="rounded-[18px] bg-white/82 px-4 py-3" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
            {copy.balance}
          </div>
          <div className="mt-2 text-xl font-semibold leading-none tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
            {latestSourceSink ? `${latestSourceSink.value.toFixed(3)} ${copy.balanceUnit}` : '-'}
          </div>
        </div>
      </div>

      <div className="rounded-[20px] bg-[color:var(--sg-surface-soft)] px-3 py-3" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold tracking-[0.08em] text-[color:var(--sg-text-faint)]">
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
        {hasIrradiance ? (
          <ChartFrame minHeight={220} style={{ height: 220 }}>
            {({ width, height }) => (
              <LineChart
                width={Math.max(width, 1)}
                height={Math.max(height, 220)}
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
                  domain={['auto', 'auto']}
                />
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
          <div className="rounded-[16px] bg-white/78 px-3 py-4 text-sm text-[color:var(--sg-text-muted)]">
            {copy.empty}
          </div>
        )}
        {!hasSourceSink ? (
          <div className="mt-3 rounded-[16px] bg-white/78 px-3 py-3 text-sm text-[color:var(--sg-text-muted)]">
            {copy.modelMissing}
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
