import { CloudSun, Coins, Gauge, Zap } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMemo } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import type {
  AdvancedModelMetrics,
  CropType,
  OverviewSignalsPayload,
  ProducePriceTrendSeries,
  ProducePricesPayload,
  SensorData,
  WeatherOutlook,
} from '../../types';
import { getWeatherLabel } from '../../utils/displayCopy';
import { selectProduceItemForCrop } from '../../utils/producePriceSelectors';
import DashboardCard from '../common/DashboardCard';

interface DecisionSnapshotGridProps {
  crop: CropType;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
  history?: SensorData[];
  overviewSignals?: OverviewSignalsPayload | null;
}

type TrendDatum = {
  label: string;
  value: number;
};

const CROP_KEYWORDS: Record<CropType, string[]> = {
  Tomato: ['tomato', '방울토마토', '토마토', 'cherry tomato'],
  Cucumber: ['cucumber', '오이', 'dadagi', 'chuicheong', '다다기', '취청'],
};

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function matchesCropSeries(series: ProducePriceTrendSeries, crop: CropType): boolean {
  const haystack = normalizeText(`${series.display_name} ${series.source_name}`);
  return CROP_KEYWORDS[crop].some((keyword) => haystack.includes(keyword));
}

function selectTrendSeriesForCrop(
  producePrices: ProducePricesPayload | null,
  crop: CropType,
  preferredKey: string | null,
  strictPreferredKey = false,
): ProducePriceTrendSeries | null {
  const seriesList = producePrices?.trend.series ?? [];
  if (seriesList.length === 0) {
    return null;
  }

  if (preferredKey) {
    const matchedByKey = seriesList.find((series) => series.key === preferredKey);
    if (matchedByKey) {
      return matchedByKey;
    }
    if (strictPreferredKey) {
      return null;
    }
  }

  const matchedByCrop = seriesList.find((series) => matchesCropSeries(series, crop));
  if (matchedByCrop) {
    return matchedByCrop;
  }

  return seriesList[0] ?? null;
}

function formatShortHour(value: number, locale: 'ko' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

function formatShortDate(value: string, locale: 'ko' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function downsampleSeries<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) {
    return items;
  }

  const step = Math.ceil(items.length / maxPoints);
  return items.filter((_, index) => index % step === 0 || index === items.length - 1);
}

function buildHistoryWindow(history: SensorData[], hours: number): SensorData[] {
  if (history.length === 0) {
    return [];
  }
  const latestTimestamp = history[history.length - 1]?.timestamp ?? Date.now();
  const cutoff = latestTimestamp - hours * 60 * 60 * 1000;
  return history.filter((point) => point.timestamp >= cutoff);
}

function TrendTile({
  icon: Icon,
  title,
  headline,
  supporting,
  seriesLabel,
  unitLabel,
  toneClassName,
  stroke,
  data,
  emptyLabel,
}: {
  icon: typeof CloudSun;
  title: string;
  headline: string;
  supporting: string;
  seriesLabel: string;
  unitLabel: string;
  toneClassName: string;
  stroke: string;
  data: TrendDatum[];
  emptyLabel: string;
}) {
  return (
    <article
      className={`flex min-h-[260px] flex-col rounded-[24px] px-4 py-4 ${toneClassName}`}
      style={{ boxShadow: 'var(--sg-shadow-card)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/84 text-[color:var(--sg-text-strong)]"
          style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{title}</div>
      </div>
      <div className="mt-3 text-lg font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]">
        {headline}
      </div>
      <div className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">{supporting}</div>
      <div className="mt-4 flex items-center justify-between text-[11px] font-semibold tracking-[0.08em] text-[color:var(--sg-text-faint)]">
        <span>{seriesLabel}</span>
        <span>{unitLabel}</span>
      </div>
      <div className="relative mt-2 min-h-0 flex-1 rounded-[18px] bg-white/82 px-2 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
            <CartesianGrid stroke="rgba(122,67,52,0.12)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={20}
              tick={{ fill: 'var(--sg-text-faint)', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={42}
              tick={{ fill: 'var(--sg-text-faint)', fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: number) => [`${Number(value).toFixed(1)} ${unitLabel}`, title]}
              labelFormatter={(label: string) => label}
              contentStyle={{
                borderRadius: '14px',
                border: '1px solid rgba(122,67,52,0.12)',
                boxShadow: 'var(--sg-shadow-card)',
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        {data.length < 2 ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-[18px] bg-white/72 text-sm font-medium text-[color:var(--sg-text-muted)]">
            {emptyLabel}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function DecisionSnapshotGrid({
  crop,
  currentData,
  modelMetrics,
  weather,
  weatherLoading,
  producePrices,
  produceLoading,
  history = [],
  overviewSignals = null,
}: DecisionSnapshotGridProps) {
  const { locale } = useLocale();
  const copy = locale === 'ko'
    ? {
        eyebrow: '보조 흐름',
        title: '날씨 · 시세 · 에너지 · 생육',
        description: '외기, 에너지, 생육은 1일 흐름으로 보고, 시세는 최근 1주 흐름으로 봅니다.',
        weatherTitle: '외기',
        marketTitle: '시세',
        energyTitle: '에너지',
        cropTitle: '생육',
        outsideSeries: '최근 1일 외기 일사량',
        marketSeries: '최근 1주 도매 시세',
        energySeries: '최근 1일 에너지 사용',
        cropSeries: '최근 1일 광합성 흐름',
        outsideEmpty: '외기 시계열이 아직 없습니다.',
        marketEmpty: '시세 시계열이 아직 없습니다.',
        energyEmpty: '에너지 시계열이 아직 없습니다.',
        cropEmpty: '생육 시계열이 아직 없습니다.',
        weatherLoading: '외기 정보 불러오는 중',
        marketLoading: '도매 시세 대기 중',
        weatherSupport: '외기 일사량 기준',
        marketSupport: '도매가격 기준',
        energySupport: '실시간 에너지 사용량 기준',
        cropSupport: '광합성 중심 생육 흐름',
        radiationUnit: 'W/m²',
        marketUnit: '원',
        energyUnit: 'kW',
        cropUnit: 'µmol/m²/s',
      }
    : {
        eyebrow: 'Support signals',
        title: 'Weather · market · energy · crop',
        description: 'Weather, energy, and crop use a 1-day window. Market uses a 7-day window.',
        weatherTitle: 'Outside',
        marketTitle: 'Market',
        energyTitle: 'Energy',
        cropTitle: 'Crop',
        outsideSeries: 'Last 1-day outside irradiance',
        marketSeries: 'Last 7-day wholesale prices',
        energySeries: 'Last 1-day energy use',
        cropSeries: 'Last 1-day photosynthesis',
        outsideEmpty: 'Outside trend is not ready yet.',
        marketEmpty: 'Market trend is not ready yet.',
        energyEmpty: 'Energy trend is not ready yet.',
        cropEmpty: 'Crop trend is not ready yet.',
        weatherLoading: 'Loading weather',
        marketLoading: 'Loading wholesale prices',
        weatherSupport: 'Based on outside irradiance',
        marketSupport: 'Wholesale basis',
        energySupport: 'Based on live energy use',
        cropSupport: 'Photosynthesis-led crop trend',
        radiationUnit: 'W/m²',
        marketUnit: 'KRW',
        energyUnit: 'kW',
        cropUnit: 'µmol/m²/s',
      };

  const selectedMarket = selectProduceItemForCrop(producePrices, crop, {
    marketPreference: ['wholesale'],
    enforcePreferredVariant: true,
  });
  const marketSeries = selectTrendSeriesForCrop(
    producePrices,
    crop,
    selectedMarket?.item?.key ?? null,
    true,
  );

  const outsideData = useMemo(() => {
    const irradiancePoints = overviewSignals?.irradiance.points ?? [];
    return downsampleSeries(
      irradiancePoints
        .slice(-24)
        .map((point) => ({
          label: formatShortHour(new Date(point.time).getTime(), locale),
          value: Number(point.shortwave_radiation_w_m2),
        }))
        .filter((point) => Number.isFinite(point.value)),
      12,
    );
  }, [locale, overviewSignals]);

  const oneDayHistory = useMemo(() => buildHistoryWindow(history, 24), [history]);

  const energyData = useMemo(() => (
    downsampleSeries(
      oneDayHistory
        .map((point) => ({
          label: formatShortHour(point.timestamp, locale),
          value: Number(point.energyUsage),
        }))
        .filter((point) => Number.isFinite(point.value)),
      18,
    )
  ), [locale, oneDayHistory]);

  const cropData = useMemo(() => (
    downsampleSeries(
      oneDayHistory
        .map((point) => ({
          label: formatShortHour(point.timestamp, locale),
          value: Number(point.photosynthesis),
        }))
        .filter((point) => Number.isFinite(point.value)),
      18,
    )
  ), [locale, oneDayHistory]);

  const marketData = (marketSeries?.points ?? [])
    .filter((point) => point.segment === 'history' && Number.isFinite(point.actual_price_krw))
    .slice(-7)
    .map((point) => ({
      label: formatShortDate(point.date, locale),
      value: Number(point.actual_price_krw),
    }));

  const preferredProduceName = locale === 'ko'
    ? (crop === 'Cucumber' ? '오이(백다다기)' : '토마토(완숙)')
    : (crop === 'Cucumber' ? 'Cucumber (Baekdadagi)' : 'Tomato (Ripe)');

  const weatherHeadline = weatherLoading || !weather
    ? copy.weatherLoading
    : `${weather.current.temperature_c.toFixed(1)}°C · ${getWeatherLabel(weather.current.weather_code, weather.current.weather_label, locale)}`;
  const marketHeadline = produceLoading || !selectedMarket?.item
    ? copy.marketLoading
    : `${preferredProduceName} ${selectedMarket.item.current_price_krw.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}${copy.marketUnit}`;
  const energyHeadline = `${modelMetrics.energy.consumption.toFixed(1)} kW · COP ${modelMetrics.energy.efficiency.toFixed(2)}`;
  const cropHeadline = `광합성 ${currentData.photosynthesis.toFixed(1)} · LAI ${modelMetrics.growth.lai.toFixed(2)}`;

  return (
    <DashboardCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      contentClassName="overflow-hidden"
    >
      <div className="grid gap-3 xl:grid-cols-2">
        <TrendTile
          icon={CloudSun}
          title={copy.weatherTitle}
          headline={weatherHeadline}
          supporting={copy.weatherSupport}
          seriesLabel={copy.outsideSeries}
          unitLabel={copy.radiationUnit}
          toneClassName="sg-tint-amber"
          stroke="#2d5d77"
          data={outsideData}
          emptyLabel={copy.outsideEmpty}
        />
        <TrendTile
          icon={Coins}
          title={copy.marketTitle}
          headline={marketHeadline}
          supporting={copy.marketSupport}
          seriesLabel={copy.marketSeries}
          unitLabel={copy.marketUnit}
          toneClassName="sg-tint-amber"
          stroke="#9d4125"
          data={marketData}
          emptyLabel={copy.marketEmpty}
        />
        <TrendTile
          icon={Zap}
          title={copy.energyTitle}
          headline={energyHeadline}
          supporting={copy.energySupport}
          seriesLabel={copy.energySeries}
          unitLabel={copy.energyUnit}
          toneClassName="sg-tint-green"
          stroke="#9e4f21"
          data={energyData}
          emptyLabel={copy.energyEmpty}
        />
        <TrendTile
          icon={Gauge}
          title={copy.cropTitle}
          headline={cropHeadline}
          supporting={copy.cropSupport}
          seriesLabel={copy.cropSeries}
          unitLabel={copy.cropUnit}
          toneClassName="sg-tint-violet"
          stroke="#7e2c2d"
          data={cropData}
          emptyLabel={copy.cropEmpty}
        />
      </div>
    </DashboardCard>
  );
}
