import { CloudSun, Coins, Gauge, Zap } from 'lucide-react';
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
import { StatusChip } from '../ui/status-chip';

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

function latestValue(data: TrendDatum[]): number | null {
  return data.length > 0 ? data[data.length - 1].value : null;
}

function formatNumeric(value: number | null, fractionDigits = 1): string {
  return value === null || !Number.isFinite(value) ? '-' : value.toFixed(fractionDigits);
}

function formatRange(data: TrendDatum[], unit: string, fractionDigits = 1): string {
  if (data.length === 0) {
    return '-';
  }

  const values = data.map((point) => point.value);
  return `${Math.min(...values).toFixed(fractionDigits)}-${Math.max(...values).toFixed(fractionDigits)} ${unit}`;
}

function formatDelta(data: TrendDatum[], unit: string, fractionDigits = 1): string {
  if (data.length < 2) {
    return '-';
  }

  const delta = data[data.length - 1].value - data[0].value;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(fractionDigits)} ${unit}`;
}

function BridgeDecisionCard({
  icon: Icon,
  testId,
  title,
  value,
  unit,
  body,
  actionLabel,
  contextLabel,
  toneClassName,
  detailRows,
  actionTone = 'growth',
  contextTone = 'stable',
}: {
  icon: typeof CloudSun;
  testId: string;
  title: string;
  value: string;
  unit: string;
  body: string;
  actionLabel: string;
  contextLabel: string;
  toneClassName: string;
  detailRows: Array<[string, string]>;
  actionTone?: 'normal' | 'growth' | 'stable' | 'warning' | 'critical' | 'muted';
  contextTone?: 'normal' | 'growth' | 'stable' | 'warning' | 'critical' | 'muted';
}) {
  return (
    <article
      className={`sg-panel flex h-full min-h-[190px] flex-col gap-2 p-3 ${toneClassName}`}
      style={{ boxShadow: 'var(--sg-shadow-card)' }}
      data-testid={`decision-bridge-card-${testId}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-[color:var(--sg-text-strong)]">{title}</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="sg-data-number text-2xl font-bold leading-none text-[color:var(--sg-text-strong)]">
              {value}
            </span>
            <span className="pb-0.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">{unit}</span>
          </div>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sg-radius-sm)] bg-white/84 text-[color:var(--sg-text-strong)]"
          style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xs leading-5 text-[color:var(--sg-text-muted)]">{body}</p>
      <dl className="grid grid-cols-2 gap-2 border-t border-[color:var(--sg-outline-soft)] pt-2">
        {detailRows.map(([label, rowValue]) => (
          <div key={label} className="min-w-0 rounded-[var(--sg-radius-xs)] bg-white/72 px-2 py-1.5">
            <dt className="truncate text-[10px] font-semibold text-[color:var(--sg-text-faint)]">{label}</dt>
            <dd className="sg-data-number mt-1 truncate text-xs font-bold text-[color:var(--sg-text-strong)]">
              {rowValue}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <StatusChip tone={actionTone}>{actionLabel}</StatusChip>
        <StatusChip tone={contextTone}>{contextLabel}</StatusChip>
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
        latest: '최신',
        points: '포인트',
        range: '범위',
        delta: '변화',
        weatherAction: '환기 확인',
        marketAction: '출하 판단',
        energyAction: '부하 점검',
        cropAction: '생육 점검',
        weatherContext: '외기 일사',
        marketContext: '도매 기준',
        energyContext: '24h 에너지',
        cropContext: '광합성',
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
        latest: 'Latest',
        points: 'Points',
        range: 'Range',
        delta: 'Delta',
        weatherAction: 'Check vents',
        marketAction: 'Plan shipment',
        energyAction: 'Check load',
        cropAction: 'Check growth',
        weatherContext: 'Outside irradiance',
        marketContext: 'Wholesale basis',
        energyContext: '24h energy',
        cropContext: 'Photosynthesis',
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

  const weatherValue = weatherLoading || !weather
    ? '-'
    : weather.current.temperature_c.toFixed(1);
  const weatherBody = weatherLoading
    ? copy.weatherLoading
    : weather
      ? getWeatherLabel(weather.current.weather_code, weather.current.weather_label, locale)
      : copy.outsideEmpty;
  const marketValue = produceLoading || !selectedMarket?.item
    ? '-'
    : selectedMarket.item.current_price_krw.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');
  const marketBody = produceLoading
    ? copy.marketLoading
    : selectedMarket?.item
      ? preferredProduceName
      : copy.marketEmpty;
  const weatherActionTone = weatherLoading ? 'warning' : weather ? 'growth' : 'muted';
  const marketActionTone = produceLoading ? 'warning' : selectedMarket?.item ? 'growth' : 'muted';

  const weatherDetails: Array<[string, string]> = [
    [copy.latest, `${formatNumeric(latestValue(outsideData))} ${copy.radiationUnit}`],
    [copy.range, formatRange(outsideData, copy.radiationUnit)],
  ];
  const marketDetails: Array<[string, string]> = [
    [copy.delta, formatDelta(marketData, copy.marketUnit, 0)],
    [copy.points, String(marketData.length)],
  ];
  const energyDetails: Array<[string, string]> = [
    [copy.delta, formatDelta(energyData, copy.energyUnit)],
    [copy.range, formatRange(energyData, copy.energyUnit)],
  ];
  const cropDetails: Array<[string, string]> = [
    ['LAI', modelMetrics.growth.lai.toFixed(2)],
    [copy.range, formatRange(cropData, copy.cropUnit)],
  ];

  return (
    <DashboardCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      contentClassName="overflow-hidden"
    >
      <div className="grid gap-3 xl:grid-cols-2">
        <BridgeDecisionCard
          icon={CloudSun}
          testId="weather"
          title={copy.weatherTitle}
          value={weatherValue}
          unit="°C"
          body={`${weatherBody} · ${copy.weatherSupport}`}
          actionLabel={copy.weatherAction}
          contextLabel={copy.weatherContext}
          toneClassName="sg-tint-amber"
          detailRows={weatherDetails}
          actionTone={weatherActionTone}
          contextTone={weather ? 'stable' : 'muted'}
        />
        <BridgeDecisionCard
          icon={Coins}
          testId="market"
          title={copy.marketTitle}
          value={marketValue}
          unit={copy.marketUnit}
          body={`${marketBody} · ${copy.marketSupport}`}
          actionLabel={copy.marketAction}
          contextLabel={copy.marketContext}
          toneClassName="sg-tint-amber"
          detailRows={marketDetails}
          actionTone={marketActionTone}
          contextTone={selectedMarket?.item ? 'stable' : 'muted'}
        />
        <BridgeDecisionCard
          icon={Zap}
          testId="energy"
          title={copy.energyTitle}
          value={modelMetrics.energy.consumption.toFixed(1)}
          unit={copy.energyUnit}
          body={`COP ${modelMetrics.energy.efficiency.toFixed(2)} · ${copy.energySupport}`}
          actionLabel={copy.energyAction}
          contextLabel={copy.energyContext}
          toneClassName="sg-tint-green"
          detailRows={energyDetails}
        />
        <BridgeDecisionCard
          icon={Gauge}
          testId="crop"
          title={copy.cropTitle}
          value={currentData.photosynthesis.toFixed(1)}
          unit={copy.cropUnit}
          body={copy.cropSupport}
          actionLabel={copy.cropAction}
          contextLabel={copy.cropContext}
          toneClassName="sg-tint-violet"
          detailRows={cropDetails}
        />
      </div>
    </DashboardCard>
  );
}
