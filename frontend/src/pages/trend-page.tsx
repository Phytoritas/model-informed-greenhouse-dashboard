import type { ReactNode } from 'react';
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
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
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
  return `${value.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')} KRW`;
}

function latestOverviewPoint(payload: OverviewSignalsPayload | null) {
  return {
    irradiance: payload?.irradiance.points.at(-1)?.shortwave_radiation_w_m2,
    sourceSink: payload?.source_sink.points.at(-1)?.source_sink_balance,
  };
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
  knowledgeSummary,
  knowledgeLoading,
  knowledgeError,
  weatherSurface,
  marketSurface,
  decisionSurface = null,
  onOpenAssistant,
}: TrendPageProps) {
  const cropLabel = getCropLabel(crop, locale);
  const selectedMarket = selectProduceItemForCrop(producePrices, crop, {
    marketPreference: ['wholesale', 'retail'],
    enforcePreferredVariant: true,
  });
  const marketItem = selectedMarket?.item ?? null;
  const overviewPoint = latestOverviewPoint(overviewSignals);
  const latestLight = history.at(-1)?.light ?? currentData.light;
  const readySurfaceCount = knowledgeSummary?.surfaces.filter((surface) => surface.status === 'ready').length ?? 0;
  const weatherStatus = weatherError ? 'warning' : weatherLoading || !weather ? 'muted' : 'normal';
  const marketStatus = produceError ? 'warning' : produceLoading || !marketItem ? 'muted' : marketItem.direction === 'up' ? 'normal' : 'muted';

  const copy = locale === 'ko'
    ? {
        title: 'Insights',
        description: '대구 외기 추세, 오이 시세, 생육 판단 신호를 그래프와 의사결정 카드로 봅니다.',
        heroBadge: '외기 · 시세 · 판단 신호',
        heroTitle: '오이 재배 판단을 날씨와 시세까지 연결',
        heroBody: '외기 예보, KAMIS 도매 시세, 내부 센서와 생육 모델을 같은 기준선에서 비교해 오늘 운영 판단으로 연결합니다.',
        primary: '그래프 보기',
        secondary: '시나리오 검토',
        previewEyebrow: 'INSIGHTS LIVE',
        previewTitle: 'Daegu weather / KAMIS / greenhouse',
        previewStatus: weatherError || produceError ? '확인 필요' : '연결됨',
        chartLabel: '날씨·시세 흐름',
        chartStatus: marketItem ? `${marketItem.direction === 'up' ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : '대기',
        live: 'Live Overview',
        freshness: weather?.source?.fetched_at ? `기상 ${weather.source.fetched_at}` : 'backend surfaces connected',
        actionsEyebrow: 'Today Insight Board',
        actionsTitle: '오늘 볼 외부 변수 4가지',
        comparisonEyebrow: 'Scenario Context',
        comparisonTitle: '외부 기준과 내부 판단 비교',
        comparisonStatus: weatherError || produceError ? '연동 확인' : '판단 가능',
        bridgeEyebrow: '날씨 · 시세 · 지식 연결',
        bridgeTitle: '그래프에서 운영 판단으로 이동',
        detailEyebrow: 'INSIGHTS FULL SURFACES',
        detailTitle: '날씨·시세·판단 그래프 전체',
        detailDescription: '아래 영역은 기존 backend hook과 패널을 그대로 사용합니다. 축소 요약이 아니라 전체 그래프와 판단 신호를 확인하는 공간입니다.',
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
        sourceSink: '소스-싱크',
        knowledgeReady: '지식 표면',
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
        freshness: weather?.source?.fetched_at ? `Weather ${weather.source.fetched_at}` : 'backend surfaces connected',
        actionsEyebrow: 'Today Insight Board',
        actionsTitle: 'Four outside signals to review today',
        comparisonEyebrow: 'Scenario Context',
        comparisonTitle: 'Outside baseline vs inside decision state',
        comparisonStatus: weatherError || produceError ? 'Check links' : 'Decision ready',
        bridgeEyebrow: 'Weather · Market · Knowledge Bridge',
        bridgeTitle: 'Move from charts to operating judgment',
        detailEyebrow: 'INSIGHTS FULL SURFACES',
        detailTitle: 'Full weather, market, and decision charts',
        detailDescription: 'The panels below keep the existing backend hooks and full chart surfaces.',
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
        knowledgeReady: 'Knowledge surfaces',
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
    },
    {
      label: copy.wind,
      value: weather ? formatNumber(weather.current.wind_speed_kmh, 1) : '-',
      unit: weather ? 'km/h' : undefined,
      detail: weather?.location?.name ?? 'Daegu',
      trendLabel: weatherStatus === 'warning' ? copy.issue : copy.connected,
      icon: Wind,
      tone: weatherStatus,
    },
    {
      label: copy.price,
      value: marketItem ? formatKrw(marketItem.current_price_krw, locale).replace(' KRW', '') : '-',
      unit: marketItem ? 'KRW' : undefined,
      detail: marketItem?.display_name ?? cropLabel,
      trend: marketItem?.direction === 'down' ? 'down' : marketItem?.direction === 'up' ? 'up' : 'stable',
      trendLabel: marketItem ? `${marketItem.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : copy.pending,
      icon: LineChartIcon,
      tone: marketStatus,
    },
    {
      label: copy.greenhouse,
      value: formatNumber(currentData.temperature, 1),
      unit: '°C',
      detail: `CO2 ${formatNumber(currentData.co2, 0)} ppm`,
      trendLabel: `RH ${formatNumber(currentData.humidity, 0)}%`,
      icon: Gauge,
      tone: 'normal',
    },
    {
      label: 'PAR',
      value: formatNumber(latestLight, 0),
      unit: 'µmol',
      detail: overviewPoint.irradiance ? `외기 ${formatNumber(overviewPoint.irradiance, 0)} W/m²` : 'sensor',
      trendLabel: 'light context',
      icon: Sun,
      tone: 'normal',
    },
    {
      label: copy.yield,
      value: formatNumber(modelMetrics.yield.predictedWeekly, 1),
      unit: 'kg/wk',
      detail: `${Math.round(modelMetrics.yield.confidence * 100)}% confidence`,
      trendLabel: copy.decision,
      icon: Sprout,
      tone: 'normal',
    },
    {
      label: copy.knowledgeReady,
      value: knowledgeSummary ? `${readySurfaceCount}/${knowledgeSummary.surfaces.length}` : '-',
      detail: knowledgeLoading ? copy.pending : knowledgeError ?? 'SmartGrow',
      trendLabel: knowledgeError ? copy.issue : copy.connected,
      icon: BookOpen,
      tone: knowledgeError ? 'warning' : knowledgeSummary ? 'normal' : 'muted',
    },
  ];

  const actionCards: FeatureActionCard[] = [
    {
      title: copy.weather,
      body: weather?.summary ?? weatherError ?? '대구 외기 예보와 실측 흐름을 운전 리듬으로 번역합니다.',
      chip: weatherError ? copy.issue : copy.connected,
      icon: CloudSun,
      tone: weatherError ? 'warning' : 'normal',
      actionLabel: copy.open,
      href: '#trend-surfaces',
    },
    {
      title: copy.market,
      body: marketItem
        ? `${marketItem.display_name}: ${formatKrw(marketItem.current_price_krw, locale)} · ${marketItem.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%`
        : produceError ?? `${cropLabel} KAMIS 시세 연결을 기다립니다.`,
      chip: produceError ? copy.issue : marketItem ? copy.connected : copy.pending,
      icon: LineChartIcon,
      tone: produceError ? 'warning' : 'normal',
      actionLabel: copy.open,
      href: '#trend-surfaces',
    },
    {
      title: copy.decision,
      body: `${copy.greenhouse} ${formatNumber(currentData.temperature, 1)}°C · VPD ${formatNumber(currentData.vpd, 2)} kPa · ${copy.yield} ${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg/wk`,
      chip: copy.connected,
      icon: Gauge,
      tone: 'normal',
      actionLabel: copy.open,
      href: '#trend-surfaces',
    },
    {
      title: copy.knowledge,
      body: knowledgeSummary
        ? `${readySurfaceCount}개 지식 표면이 준비되어 날씨·시세 판단을 자료 검색과 연결합니다.`
        : knowledgeError ?? '지식 DB 상태를 확인하고 질문 도우미로 이동합니다.',
      chip: knowledgeError ? copy.issue : knowledgeSummary ? copy.connected : copy.pending,
      icon: BookOpen,
      tone: knowledgeError ? 'warning' : 'normal',
      actionLabel: copy.check,
      onAction: onOpenAssistant,
    },
  ];

  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: copy.weather,
      value: weather ? weather.current.weather_label || `${formatNumber(weather.current.temperature_c, 1)}°C` : copy.pending,
      body: weather ? `${weather.location?.name ?? 'Daegu'} · ${weather.summary}` : weatherError ?? '기상 API 응답을 기다립니다.',
      chip: weatherError ? copy.issue : copy.connected,
      chipTone: weatherError ? 'warning' : 'growth',
      icon: CloudSun,
      rows: [
        [copy.temp, weather ? `${formatNumber(weather.current.temperature_c, 1)}°C` : '-'],
        [copy.wind, weather ? `${formatNumber(weather.current.wind_speed_kmh, 1)} km/h` : '-'],
      ],
      actionLabel: copy.open,
      href: '#trend-surfaces',
    },
    {
      title: copy.market,
      value: marketItem?.display_name ?? cropLabel,
      body: marketItem ? `${formatKrw(marketItem.current_price_krw, locale)} / ${marketItem.unit}` : produceError ?? 'KAMIS 품목별 시세를 불러오는 중입니다.',
      chip: produceError ? copy.issue : marketItem ? copy.connected : copy.pending,
      chipTone: produceError ? 'warning' : marketItem ? 'growth' : 'muted',
      icon: Sprout,
      rows: [
        [copy.price, marketItem ? formatKrw(marketItem.current_price_krw, locale) : '-'],
        [copy.change, marketItem ? `${marketItem.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : '-'],
      ],
      actionLabel: copy.open,
      href: '#trend-surfaces',
    },
    {
      title: copy.knowledge,
      value: knowledgeSummary ? `${readySurfaceCount}/${knowledgeSummary.surfaces.length}` : copy.pending,
      body: knowledgeSummary?.advisorySurfaceNames.slice(0, 3).join(', ') || knowledgeError || '지식 DB와 자료 검색 상태를 확인합니다.',
      chip: knowledgeError ? copy.issue : copy.connected,
      chipTone: knowledgeError ? 'warning' : 'growth',
      icon: BookOpen,
      rows: [
        [copy.knowledgeReady, knowledgeSummary ? `${readySurfaceCount}/${knowledgeSummary.surfaces.length}` : '-'],
        [cropLabel, knowledgeSummary?.cropKey ?? crop.toLowerCase()],
      ],
      actionLabel: copy.check,
      onAction: onOpenAssistant,
    },
  ];

  const chartValues = [
    ...history.slice(-5).map((point) => point.light),
    ...((weather?.daily ?? []).slice(0, 3).map((day) => day.shortwave_radiation_sum_mj_m2)),
  ];

  return (
    <FeatureLandingFrame
      title={copy.title}
      description={copy.description}
      heroBadge={copy.heroBadge}
      heroTitle={copy.heroTitle}
      heroBody={copy.heroBody}
      primaryAction={{ label: copy.primary, href: '#trend-surfaces' }}
      secondaryAction={{ label: copy.secondary, to: '/scenarios' }}
      preview={{
        eyebrow: copy.previewEyebrow,
        title: copy.previewTitle,
        statusLabel: copy.previewStatus,
        statusTone: weatherError || produceError ? 'warning' : 'growth',
        metrics: [
          { label: copy.temp, value: weather ? `${formatNumber(weather.current.temperature_c, 1)}°C` : '-', detail: 'Daegu' },
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
        subtitle: locale === 'ko' ? '대구 날씨와 KAMIS 시세' : 'Daegu weather and KAMIS market',
        badgeCaption: 'KAMIS',
        badgeLabel: marketItem ? `${marketItem.direction === 'up' ? 'UP' : marketItem.direction.toUpperCase()}` : copy.pending,
        rows: [
          [copy.temp, weather ? `${formatNumber(weather.current.temperature_c, 1)}°C` : '-'],
          [copy.wind, weather ? `${formatNumber(weather.current.wind_speed_kmh, 1)} km/h` : '-'],
          [copy.price, marketItem ? formatKrw(marketItem.current_price_krw, locale) : '-'],
          [copy.change, marketItem ? `${marketItem.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : '-'],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '내부 판단' : 'Inside decision state',
        subtitle: locale === 'ko' ? '센서·모델·지식 신호' : 'Sensor, model, and knowledge signal',
        badgeCaption: 'MODEL',
        badgeLabel: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg/wk`,
        rows: [
          [copy.greenhouse, `${formatNumber(currentData.temperature, 1)}°C`],
          ['VPD', `${formatNumber(currentData.vpd, 2)} kPa`],
          [copy.sourceSink, typeof overviewPoint.sourceSink === 'number' ? formatNumber(overviewPoint.sourceSink, 2) : '-'],
          [copy.knowledgeReady, knowledgeSummary ? `${readySurfaceCount}/${knowledgeSummary.surfaces.length}` : '-'],
        ],
      }}
      bridgeEyebrow={copy.bridgeEyebrow}
      bridgeTitle={copy.bridgeTitle}
      bridgeCards={bridgeCards}
      detailEyebrow={copy.detailEyebrow}
      detailTitle={copy.detailTitle}
      detailDescription={copy.detailDescription}
      onOpenAssistant={onOpenAssistant}
    >
      <section
        id="trend-surfaces"
        tabIndex={-1}
        aria-label={copy.detailTitle}
        className="grid grid-cols-1 items-start gap-5 scroll-mt-24 focus:outline-none"
      >
        <div className="min-h-0">{weatherSurface}</div>
        <div className="min-h-0">{marketSurface}</div>
        {decisionSurface ? <div className="min-h-0">{decisionSurface}</div> : null}
        <div className="sr-only" aria-live="polite">
          <BarChart3 aria-hidden="true" />
          {copy.detailDescription}
        </div>
      </section>
    </FeatureLandingFrame>
  );
}
