import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CloudSun,
  Gauge,
  LineChart as LineChartIcon,
  Sprout,
  Sun,
  Wind,
} from 'lucide-react';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
} from '../components/dashboard/FeatureLandingFrame';
import { StatusChip } from '../components/ui/status-chip';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { PhytoSectionTab } from '../routes/phytosyncSections';
import type {
  AdvancedModelMetrics,
  CropType,
  OverviewSignalsPayload,
  ProducePricesPayload,
  SensorData,
  WeatherOutlook,
} from '../types';
import { getCropLabel } from '../utils/displayCopy';
import { selectProduceItemForCrop } from '../utils/producePriceSelectors';
import { cn } from '../utils/cn';
import { appendFiniteValue, mapNumericSeries, pickNumericSeries } from '../utils/metricTrendSeries';

interface TrendPageProps {
  locale: 'ko' | 'en';
  crop: CropType;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  history: SensorData[];
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
  produceError: string | null;
  overviewSignals: OverviewSignalsPayload | null;
  knowledgeSummary: SmartGrowKnowledgeSummary | null;
  knowledgeLoading: boolean;
  knowledgeError: string | null;
  weatherSurface: ReactNode;
  marketSurface: ReactNode;
  decisionSurface?: ReactNode;
  onOpenAssistant: () => void;
  tabs?: PhytoSectionTab[];
  activeTabId?: string;
  onSelectTab?: (id: string) => void;
}

const TREND_SURFACE_IDS = ['trend-weather', 'trend-market', 'trend-decision'] as const;
type TrendSurfaceId = typeof TREND_SURFACE_IDS[number];

function isTrendSurfaceId(id: string | undefined | null): id is TrendSurfaceId {
  return Boolean(id && TREND_SURFACE_IDS.includes(id as TrendSurfaceId));
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatKrw(value: number | null | undefined, locale: 'ko' | 'en'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return locale === 'ko'
    ? `${value.toLocaleString('ko-KR')}원`
    : `${value.toLocaleString('en-US')} KRW`;
}

function latestOverviewPoint(payload: OverviewSignalsPayload | null) {
  return {
    irradiance: payload?.irradiance.points.at(-1)?.shortwave_radiation_w_m2,
    sourceSink: payload?.source_sink.points.at(-1)?.source_sink_balance,
  };
}

function SurfaceSection({
  id,
  step,
  title,
  body,
  chip,
  chipTone,
  active,
  children,
}: {
  id: TrendSurfaceId;
  step: string;
  title: string;
  body: string;
  chip: string;
  chipTone: 'growth' | 'stable' | 'warning' | 'muted';
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className={cn(
        'scroll-mt-24 rounded-[var(--sg-radius-xl)] border bg-[color:var(--sg-surface-raised)] p-2 focus:outline-none sm:p-3',
        active
          ? 'border-[color:var(--sg-color-sage)] shadow-[0_18px_54px_-42px_rgba(108,127,94,0.75)]'
          : 'border-[color:var(--sg-outline-soft)] shadow-[var(--sg-shadow-card)]',
      )}
    >
      <div className="mb-3 flex flex-col gap-2 rounded-[var(--sg-radius-lg)] bg-[color:var(--sg-surface-muted)] px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="sg-eyebrow">{step}</p>
          <h3 id={`${id}-title`} className="mt-1 text-lg font-bold text-[color:var(--sg-text-strong)]">
            {title}
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--sg-text-muted)]">
            {body}
          </p>
        </div>
        <StatusChip tone={chipTone} className="w-fit shrink-0">{chip}</StatusChip>
      </div>
      {children}
    </section>
  );
}

export default function TrendPage({
  locale,
  crop,
  currentData,
  modelMetrics,
  history,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  produceLoading,
  produceError,
  overviewSignals,
  weatherSurface,
  marketSurface,
  decisionSurface = null,
  onOpenAssistant,
  tabs = [],
  activeTabId,
  onSelectTab,
}: TrendPageProps) {
  const location = useLocation();
  const cropLabel = getCropLabel(crop, locale);
  const selectedMarket = selectProduceItemForCrop(producePrices, crop, {
    marketPreference: ['wholesale', 'retail'],
    enforcePreferredVariant: true,
  });
  const marketItem = selectedMarket?.item ?? null;
  const selectedPriceTrend = marketItem
    ? producePrices?.trend?.series.find((series) => series.key === marketItem.key || series.display_name === marketItem.display_name)
    : null;
  const marketPriceSeries = appendFiniteValue(
    mapNumericSeries(selectedPriceTrend?.points, (point) => point.actual_price_krw, 24),
    marketItem?.current_price_krw,
    24,
  );
  const overviewPoint = latestOverviewPoint(overviewSignals);
  const latestLight = history.at(-1)?.light ?? currentData.light;
  const weatherStatus = weatherError ? 'warning' : weatherLoading || !weather ? 'muted' : 'normal';
  const marketStatus = produceError ? 'warning' : produceLoading || !marketItem ? 'muted' : marketItem.direction === 'up' ? 'normal' : 'muted';
  const activeSurfaceId = isTrendSurfaceId(activeTabId) ? activeTabId : 'trend-weather';

  useEffect(() => {
    const hashId = location.hash.replace(/^#/, '');
    if (!isTrendSurfaceId(hashId)) {
      return;
    }
    const scrollToTarget = () => {
      const target = document.getElementById(hashId);
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    };
    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(scrollToTarget);
      return () => window.cancelAnimationFrame(frame);
    }
    const timeoutId = window.setTimeout(scrollToTarget, 0);
    return () => window.clearTimeout(timeoutId);
  }, [location.hash]);

  const copy = locale === 'ko'
    ? {
        title: '날씨와 시세',
        description: '대구 외기 추세, 오이 시세, 생육 판단 신호를 그래프와 의사결정 카드로 봅니다.',
        heroBadge: '외기 · 시세 · 판단 신호',
        heroTitle: '오이 재배 판단을 날씨와 시세까지 연결',
        heroBody: '외기 예보, 도매 시세, 내부 센서와 생육 모델을 같은 기준선에서 비교해 오늘 운영 판단으로 연결합니다.',
        primary: '그래프 보기',
        secondary: '시나리오 검토',
        previewEyebrow: 'INSIGHTS LIVE',
        previewTitle: '대구 날씨 · 도매 시세 · 온실',
        previewStatus: weatherError || produceError ? '확인 필요' : '연결됨',
        chartLabel: '날씨·시세 흐름',
        chartStatus: marketItem ? `${marketItem.direction === 'up' ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : '대기',
        live: '실시간 요약',
        freshness: weather?.source?.fetched_at ? `기상 ${weather.source.fetched_at}` : '실시간 정보 확인 중',
        actionsEyebrow: '오늘 외부 변수',
        actionsTitle: '오늘 볼 외부 변수 4가지',
        comparisonEyebrow: '상황 비교',
        comparisonTitle: '외부 기준과 내부 판단 비교',
        comparisonStatus: weatherError || produceError ? '연동 확인' : '판단 가능',
        bridgeEyebrow: '날씨 · 시세 · 지식 연결',
        bridgeTitle: '그래프에서 운영 판단으로 이동',
        detailEyebrow: '초보자용 그래프 워크스페이스',
        detailTitle: '외기·시세 그래프를 순서대로 보기',
        detailDescription: '처음에는 1 외기 그래프, 2 시세 그래프, 3 판단 신호 순서로 보면 됩니다. 기존 연결 기능과 전체 패널은 그대로 유지합니다.',
        weather: '외기 추세',
        market: '시세 추세',
        decision: '판단 신호',
        knowledge: '지식 확인',
        open: '열기',
        check: '확인',
        connected: '연결됨',
        pending: '대기',
        issue: '확인 필요',
        temp: '외기',
        wind: '풍속',
        price: '현재가',
        change: '전일비',
        greenhouse: '온실',
        yield: '주간 수확',
        sourceSink: '공급력·착과부담',
        guideWeatherTitle: '외기 그래프',
        guideWeatherBody: '대구 예보의 최고·최저기온, 강수, 일사량을 먼저 확인합니다.',
        guideMarketTitle: '시세 그래프',
        guideMarketBody: '도매·소매 가격과 2주 실측/평년 추세선을 확인합니다.',
        guideDecisionTitle: '판단 신호',
        guideDecisionBody: '외기와 시세를 온실 센서·생육 계산 판단으로 연결합니다.',
        weatherSectionTitle: '외기 그래프: 대구 날씨 추세',
        weatherSectionBody: '환기, 보온, 차광 판단에 필요한 외기 변화를 큰 그래프로 먼저 봅니다.',
        marketSectionTitle: '시세 그래프: 오이 가격 추세',
        marketSectionBody: '대표 오이 품목의 최신 스냅샷과 실측/평년 가격선을 한 자리에서 비교합니다.',
        decisionSectionTitle: '판단 신호: 온실·외부 변수 연결',
        decisionSectionBody: '외기, 전력, 시세, 생육 신호를 한 번 더 묶어서 오늘 의사결정 근거를 정리합니다.',
        chartTabs: '그래프 바로가기',
      }
    : {
        title: 'Insights',
        description: 'Read Daegu weather, cucumber prices, and greenhouse decision signals as charts and cards.',
        heroBadge: 'Weather · Market · Decision',
        heroTitle: 'Connect cucumber decisions to weather and prices',
        heroBody: 'Compare outside forecast, KAMIS produce prices, internal sensors, and crop-model signals on one operating line.',
        primary: 'Review Charts',
        secondary: 'Run Scenarios',
        previewEyebrow: 'INSIGHTS LIVE',
        previewTitle: 'Daegu weather / KAMIS / greenhouse',
        previewStatus: weatherError || produceError ? 'Check' : 'Connected',
        chartLabel: 'Weather-market flow',
        chartStatus: marketItem ? `${marketItem.direction === 'up' ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : 'Pending',
        live: 'Live Overview',
        freshness: weather?.source?.fetched_at ? `Weather ${weather.source.fetched_at}` : 'Weather and market data loading',
        actionsEyebrow: 'Today Insight Board',
        actionsTitle: 'Four outside signals to review today',
        comparisonEyebrow: 'Scenario Context',
        comparisonTitle: 'Outside baseline vs inside decision state',
        comparisonStatus: weatherError || produceError ? 'Check links' : 'Decision ready',
        bridgeEyebrow: 'Weather · Market · Knowledge Bridge',
        bridgeTitle: 'Move from charts to operating judgment',
        detailEyebrow: 'BEGINNER GRAPH WORKSPACE',
        detailTitle: 'Review weather and market charts in order',
        detailDescription: 'Start with 1 weather, 2 market, and 3 decision signals. The existing backend hooks and full chart panels stay intact.',
        weather: 'Weather trend',
        market: 'Market trend',
        decision: 'Decision signals',
        knowledge: 'Knowledge check',
        open: 'Open',
        check: 'Check',
        connected: 'Connected',
        pending: 'Pending',
        issue: 'Check needed',
        temp: 'Outside',
        wind: 'Wind',
        price: 'Current price',
        change: 'D/D',
        greenhouse: 'Greenhouse',
        yield: 'Weekly yield',
        sourceSink: 'Source-sink',
        guideWeatherTitle: 'Weather chart',
        guideWeatherBody: 'Check Daegu temperature, rain, radiation, and wind forecast first.',
        guideMarketTitle: 'Market chart',
        guideMarketBody: 'Review KAMIS wholesale/retail snapshots and 2-week actual/normal trends.',
        guideDecisionTitle: 'Decision signals',
        guideDecisionBody: 'Connect weather and prices back to greenhouse sensor and crop-model signals.',
        weatherSectionTitle: 'Weather chart: Daegu outside trend',
        weatherSectionBody: 'Read the outside signal needed for venting, heating, and shade decisions as a large chart.',
        marketSectionTitle: 'Market chart: KAMIS cucumber price trend',
        marketSectionBody: 'Compare lead cucumber snapshots with actual and seasonal-normal price lines.',
        decisionSectionTitle: 'Decision signals: greenhouse and outside context',
        decisionSectionBody: 'Tie weather, energy, market, and crop signals back to today’s operating basis.',
        chartTabs: 'Chart shortcuts',
      };

  const metrics: FeatureMetric[] = [
    {
      label: copy.temp,
      value: weather ? formatNumber(weather.current.temperature_c, 1) : '-',
      unit: weather ? '°C' : undefined,
      detail: weather?.current.weather_label ?? (weatherLoading ? copy.pending : copy.issue),
      trendLabel: weatherStatus === 'warning' ? copy.issue : copy.connected,
      icon: CloudSun,
      tone: weatherStatus,
      series: appendFiniteValue(mapNumericSeries(weather?.daily, (day) => day.temperature_max_c, 10), weather?.current.temperature_c, 10),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '외기 온도 흐름' : 'Outside temperature trend',
    },
    {
      label: copy.wind,
      value: weather ? formatNumber(weather.current.wind_speed_kmh, 1) : '-',
      unit: weather ? 'km/h' : undefined,
      detail: weather?.location?.name ?? (locale === 'ko' ? '대구' : 'Daegu'),
      trendLabel: weatherStatus === 'warning' ? copy.issue : copy.connected,
      icon: Wind,
      tone: weatherStatus,
      series: appendFiniteValue(mapNumericSeries(weather?.daily, (day) => day.wind_speed_max_kmh, 10), weather?.current.wind_speed_kmh, 10),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '외기 풍속 흐름' : 'Outside wind trend',
    },
    {
      label: copy.price,
      value: marketItem ? formatKrw(marketItem.current_price_krw, locale).replace(' KRW', '') : '-',
      unit: marketItem ? (locale === 'ko' ? '원' : 'KRW') : undefined,
      detail: marketItem?.display_name ?? cropLabel,
      trend: marketItem?.direction === 'down' ? 'down' : marketItem?.direction === 'up' ? 'up' : 'stable',
      trendLabel: marketItem ? `${marketItem.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : copy.pending,
      icon: LineChartIcon,
      tone: marketStatus,
      series: marketPriceSeries,
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '시세 흐름' : 'Market price trend',
    },
    {
      label: copy.greenhouse,
      value: formatNumber(currentData.temperature, 1),
      unit: '°C',
      detail: `CO2 ${formatNumber(currentData.co2, 0)} ppm`,
      trendLabel: `RH ${formatNumber(currentData.humidity, 0)}%`,
      icon: Gauge,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'temperature', 24), currentData.temperature, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '온실 온도 흐름' : 'Greenhouse temperature trend',
    },
    {
      label: 'PAR',
      value: formatNumber(latestLight, 0),
      unit: 'µmol',
      detail: overviewPoint.irradiance ? `외기 ${formatNumber(overviewPoint.irradiance, 0)} W/m²` : (locale === 'ko' ? '센서' : 'sensor'),
      trendLabel: locale === 'ko' ? '광 환경' : 'light context',
      icon: Sun,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'light', 24), latestLight, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '광량 흐름' : 'PAR trend',
    },
    {
      label: copy.yield,
      value: formatNumber(modelMetrics.yield.predictedWeekly, 1),
      unit: locale === 'ko' ? 'kg/주' : 'kg/wk',
      detail: locale === 'ko' ? `신뢰도 ${Math.round(modelMetrics.yield.confidence * 100)}%` : `${Math.round(modelMetrics.yield.confidence * 100)}% confidence`,
      trendLabel: copy.decision,
      icon: Sprout,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'photosynthesis', 24), currentData.photosynthesis, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '광합성 흐름' : 'Photosynthesis trend',
    },
    {
      label: copy.sourceSink,
      value: typeof overviewPoint.sourceSink === 'number' ? formatNumber(overviewPoint.sourceSink, 2) : '-',
      detail: locale === 'ko' ? '공급력 균형' : 'crop balance',
      trendLabel: copy.decision,
      icon: BookOpen,
      tone: typeof overviewPoint.sourceSink === 'number' && overviewPoint.sourceSink < -0.15 ? 'warning' : 'normal',
      series: mapNumericSeries(overviewSignals?.source_sink.points, (point) => point.source_sink_balance, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '공급력 균형 흐름' : 'Source-sink trend',
    },
  ];
  const selectTrendSurface = (id: TrendSurfaceId) => {
    if (onSelectTab) {
      onSelectTab(id);
      return;
    }
    const target = document.getElementById(id);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  const actionCards: FeatureActionCard[] = [
    {
      title: copy.weather,
      body: weather?.summary ?? weatherError ?? '대구 외기 예보와 실측 흐름을 운전 리듬으로 번역합니다.',
      chip: weatherError ? copy.issue : copy.connected,
      icon: CloudSun,
      tone: weatherError ? 'warning' : 'normal',
      actionLabel: copy.open,
      onAction: () => selectTrendSurface('trend-weather'),
    },
    {
      title: copy.market,
      body: marketItem
        ? `${marketItem.display_name}: ${formatKrw(marketItem.current_price_krw, locale)} · ${marketItem.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%`
        : produceError ?? `${cropLabel} 시세 연결을 기다립니다.`,
      chip: produceError ? copy.issue : marketItem ? copy.connected : copy.pending,
      icon: LineChartIcon,
      tone: produceError ? 'warning' : 'normal',
      actionLabel: copy.open,
      onAction: () => selectTrendSurface('trend-market'),
    },
    {
      title: copy.decision,
      body: `${copy.greenhouse} ${formatNumber(currentData.temperature, 1)}°C · VPD ${formatNumber(currentData.vpd, 2)} kPa · ${copy.yield} ${formatNumber(modelMetrics.yield.predictedWeekly, 1)} ${locale === 'ko' ? 'kg/주' : 'kg/wk'}`,
      chip: copy.connected,
      icon: Gauge,
      tone: 'normal',
      actionLabel: copy.open,
      onAction: () => selectTrendSurface('trend-decision'),
    },
  ];

  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: copy.weather,
      value: weather ? weather.current.weather_label || `${formatNumber(weather.current.temperature_c, 1)}°C` : copy.pending,
      body: weather ? `${weather.location?.name ?? (locale === 'ko' ? '대구' : 'Daegu')} · ${weather.summary}` : weatherError ?? (locale === 'ko' ? '기상 정보를 불러오는 중입니다.' : 'Waiting for weather response.'),
      chip: weatherError ? copy.issue : copy.connected,
      chipTone: weatherError ? 'warning' : 'growth',
      icon: CloudSun,
      rows: [
        [copy.temp, weather ? `${formatNumber(weather.current.temperature_c, 1)}°C` : '-'],
        [copy.wind, weather ? `${formatNumber(weather.current.wind_speed_kmh, 1)} km/h` : '-'],
      ],
      actionLabel: copy.open,
      onAction: () => selectTrendSurface('trend-weather'),
    },
    {
      title: copy.market,
      value: marketItem?.display_name ?? cropLabel,
      body: marketItem ? `${formatKrw(marketItem.current_price_krw, locale)} / ${marketItem.unit}` : produceError ?? (locale === 'ko' ? '품목별 시세를 불러오는 중입니다.' : 'KAMIS produce prices are loading.'),
      chip: produceError ? copy.issue : marketItem ? copy.connected : copy.pending,
      chipTone: produceError ? 'warning' : marketItem ? 'growth' : 'muted',
      icon: Sprout,
      rows: [
        [copy.price, marketItem ? formatKrw(marketItem.current_price_krw, locale) : '-'],
        [copy.change, marketItem ? `${marketItem.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : '-'],
      ],
      actionLabel: copy.open,
      onAction: () => selectTrendSurface('trend-market'),
    },
    {
      title: copy.decision,
      value: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} ${locale === 'ko' ? 'kg/주' : 'kg/wk'}`,
      body: locale === 'ko'
        ? `온실 ${formatNumber(currentData.temperature, 1)}°C, VPD ${formatNumber(currentData.vpd, 2)} kPa, 공급력 균형 ${typeof overviewPoint.sourceSink === 'number' ? formatNumber(overviewPoint.sourceSink, 2) : '-'}를 함께 봅니다.`
        : `Greenhouse ${formatNumber(currentData.temperature, 1)}°C, VPD ${formatNumber(currentData.vpd, 2)} kPa, source-sink ${typeof overviewPoint.sourceSink === 'number' ? formatNumber(overviewPoint.sourceSink, 2) : '-'}.`,
      chip: copy.connected,
      chipTone: typeof overviewPoint.sourceSink === 'number' && overviewPoint.sourceSink < -0.15 ? 'warning' : 'growth',
      icon: BookOpen,
      rows: [
        [copy.greenhouse, `${formatNumber(currentData.temperature, 1)}°C`],
        [copy.sourceSink, typeof overviewPoint.sourceSink === 'number' ? formatNumber(overviewPoint.sourceSink, 2) : '-'],
      ],
      actionLabel: copy.check,
      onAction: () => selectTrendSurface('trend-decision'),
    },
  ];

  const chartValues = [
    ...history.slice(-5).map((point) => point.light),
    ...((weather?.daily ?? []).slice(0, 3).map((day) => day.shortwave_radiation_sum_mj_m2)),
  ];
  const trendTabs = tabs.length > 0
    ? tabs
    : [
        { id: 'trend-weather', label: copy.guideWeatherTitle },
        { id: 'trend-market', label: copy.guideMarketTitle },
        { id: 'trend-decision', label: copy.guideDecisionTitle },
      ];
  const handleSurfaceSelect = (id: TrendSurfaceId) => {
    selectTrendSurface(id);
  };

  return (
    <FeatureLandingFrame
      title={copy.title}
      description={copy.description}
      heroBadge={copy.heroBadge}
      heroTitle={copy.heroTitle}
      heroBody={copy.heroBody}
      primaryAction={{ label: copy.primary, onClick: () => selectTrendSurface('trend-weather') }}
      secondaryAction={{ label: copy.secondary, to: '/scenarios' }}
      preview={{
        eyebrow: copy.previewEyebrow,
        title: copy.previewTitle,
        statusLabel: copy.previewStatus,
        statusTone: weatherError || produceError ? 'warning' : 'growth',
        metrics: [
          { label: copy.temp, value: weather ? `${formatNumber(weather.current.temperature_c, 1)}°C` : '-', detail: locale === 'ko' ? '대구' : 'Daegu' },
          { label: copy.price, value: marketItem ? formatKrw(marketItem.current_price_krw, locale).replace(' KRW', '') : '-', detail: marketItem?.unit },
          { label: copy.yield, value: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg`, detail: cropLabel },
        ],
        chartLabel: copy.chartLabel,
        chartStatus: copy.chartStatus,
        chartValues,
      }}
      metricsEyebrow={copy.live}
      metricsFreshness={copy.freshness}
      metrics={metrics}
      actionsEyebrow={copy.actionsEyebrow}
      actionsTitle={copy.actionsTitle}
      actions={actionCards}
      comparisonEyebrow={copy.comparisonEyebrow}
      comparisonTitle={copy.comparisonTitle}
      comparisonStatusLabel={copy.comparisonStatus}
      comparisonStatusTone={weatherError || produceError ? 'warning' : 'growth'}
      comparisonNote={cropLabel}
      baseline={{
        title: locale === 'ko' ? '외부 기준' : 'Outside baseline',
        subtitle: locale === 'ko' ? '대구 날씨와 도매 시세' : 'Daegu weather and KAMIS market',
        badgeCaption: locale === 'ko' ? '시세' : 'KAMIS',
        badgeLabel: marketItem
          ? (locale === 'ko'
            ? (marketItem.direction === 'up' ? '상승' : marketItem.direction === 'down' ? '하락' : '보합')
            : `${marketItem.direction === 'up' ? 'UP' : marketItem.direction.toUpperCase()}`)
          : copy.pending,
        rows: [
          [copy.temp, weather ? `${formatNumber(weather.current.temperature_c, 1)}°C` : '-'],
          [copy.wind, weather ? `${formatNumber(weather.current.wind_speed_kmh, 1)} km/h` : '-'],
          [copy.price, marketItem ? formatKrw(marketItem.current_price_krw, locale) : '-'],
          [copy.change, marketItem ? `${marketItem.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : '-'],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '내부 판단' : 'Inside decision state',
        subtitle: locale === 'ko' ? '센서·모델·생육 신호' : 'Sensor, model, and crop signal',
        badgeCaption: locale === 'ko' ? '예측' : 'MODEL',
        badgeLabel: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} ${locale === 'ko' ? 'kg/주' : 'kg/wk'}`,
        rows: [
          [copy.greenhouse, `${formatNumber(currentData.temperature, 1)}°C`],
          [locale === 'ko' ? '습도 부담' : 'VPD', `${formatNumber(currentData.vpd, 2)} kPa`],
          [copy.sourceSink, typeof overviewPoint.sourceSink === 'number' ? formatNumber(overviewPoint.sourceSink, 2) : '-'],
          [copy.yield, `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} ${locale === 'ko' ? 'kg/주' : 'kg/wk'}`],
        ],
      }}
      bridgeEyebrow={copy.bridgeEyebrow}
      bridgeTitle={copy.bridgeTitle}
      bridgeCards={bridgeCards}
      detailEyebrow={copy.detailEyebrow}
      detailTitle={copy.detailTitle}
      detailDescription={copy.detailDescription}
      sectionTabs={trendTabs}
      activeSectionId={activeSurfaceId}
      onSelectSection={(id) => {
        if (isTrendSurfaceId(id)) {
          handleSurfaceSelect(id);
        }
      }}
      onOpenAssistant={onOpenAssistant}
    >
      <section
        id="trend-surfaces"
        tabIndex={-1}
        aria-label={copy.detailTitle}
        className="grid grid-cols-1 items-start gap-4 scroll-mt-24 focus:outline-none"
      >
        {activeSurfaceId === 'trend-weather' ? (
          <SurfaceSection
            id="trend-weather"
            step={locale === 'ko' ? '01 / 외기 그래프' : '01 / Weather'}
            title={copy.weatherSectionTitle}
            body={copy.weatherSectionBody}
            chip={weatherError ? copy.issue : weather ? copy.connected : copy.pending}
            chipTone={weatherError ? 'warning' : weather ? 'growth' : 'muted'}
            active
          >
            <div className="min-h-0">{weatherSurface}</div>
          </SurfaceSection>
        ) : null}

        {activeSurfaceId === 'trend-market' ? (
          <SurfaceSection
            id="trend-market"
            step={locale === 'ko' ? '02 / 시세 그래프' : '02 / Market'}
            title={copy.marketSectionTitle}
            body={copy.marketSectionBody}
            chip={produceError ? copy.issue : marketItem ? copy.connected : copy.pending}
            chipTone={produceError ? 'warning' : marketItem ? 'growth' : 'muted'}
            active
          >
            <div className="min-h-0">{marketSurface}</div>
          </SurfaceSection>
        ) : null}

        {activeSurfaceId === 'trend-decision' && decisionSurface ? (
          <SurfaceSection
            id="trend-decision"
            step={locale === 'ko' ? '03 / 판단 신호' : '03 / Decision'}
            title={copy.decisionSectionTitle}
            body={copy.decisionSectionBody}
            chip={copy.connected}
            chipTone="stable"
            active
          >
            <div className="min-h-0">{decisionSurface}</div>
          </SurfaceSection>
        ) : null}

        <div className="sr-only" aria-live="polite">
          <BarChart3 aria-hidden="true" />
          {copy.detailDescription}
        </div>
      </section>
    </FeatureLandingFrame>
  );
}
