import type { ReactNode } from 'react';
import { BookOpen, Bot, FlaskConical, MessageCircle, Search, ShieldCheck, Sprout } from 'lucide-react';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
  type FeatureSectionTab,
} from '../components/dashboard/FeatureLandingFrame';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  WeatherOutlook,
} from '../types';
import { selectProduceItemForCrop } from '../utils/producePriceSelectors';
import { appendFiniteValue, mapNumericSeries, pickNumericSeries } from '../utils/metricTrendSeries';

interface AssistantPageProps {
  locale: 'ko' | 'en';
  crop: CropType;
  cropLabel: string;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
  forecast?: ForecastData | null;
  history?: SensorData[];
  producePrices?: ProducePricesPayload | null;
  weather?: WeatherOutlook | null;
  rtrProfile?: RtrProfile | null;
  summary: SmartGrowKnowledgeSummary | null;
  smartGrowLoading?: boolean;
  smartGrowError?: string | null;
  sectionTabs?: FeatureSectionTab[];
  activeSectionId?: string;
  onSelectSection?: (id: string) => void;
  surface: ReactNode;
  summaryRail?: ReactNode;
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

export default function AssistantPage({
  locale,
  crop,
  cropLabel,
  currentData,
  metrics,
  forecast = null,
  history = [],
  producePrices = null,
  weather = null,
  rtrProfile = null,
  summary,
  smartGrowLoading = false,
  smartGrowError = null,
  sectionTabs = [],
  activeSectionId,
  onSelectSection,
  surface,
  summaryRail = null,
  onOpenAssistant,
}: AssistantPageProps) {
  const selectedMarket = selectProduceItemForCrop(producePrices, crop, {
    marketPreference: ['wholesale', 'retail'],
    enforcePreferredVariant: true,
  });
  const selectedPriceTrend = selectedMarket?.item
    ? producePrices?.trend?.series.find((series) => series.key === selectedMarket.item.key || series.display_name === selectedMarket.item.display_name)
    : null;
  const marketPriceSeries = appendFiniteValue(
    mapNumericSeries(selectedPriceTrend?.points, (point) => point.actual_price_krw, 24),
    selectedMarket?.item?.current_price_krw,
    24,
  );
  const pesticideReady = summary?.pesticideReady === true;
  const nutrientReady = summary?.nutrientReady === true;
  const nutrientCorrectionReady = summary?.nutrientCorrectionReady === true;
  const latestLight = history.at(-1)?.light ?? currentData.light;
  const forecastHarvest = forecast?.total_harvest_kg;

  const copy = locale === 'ko'
    ? {
        title: '자료·질문',
        description: '질문 도우미, 자료 목차 검색, 농약·양액 솔루션을 한 화면에서 확인합니다.',
        heroBadge: '질문 · 자료 · 솔루션',
        heroTitle: '농민이 바로 이해하는 자료 기반 질문 도우미',
        heroBody: '짧은 질문을 재배 맥락, 재배 자료, 농약·양액 도구와 연결해 근거가 보이는 권고 형태로 정리합니다.',
        primary: '질문하기',
        secondary: '자료 찾기',
        previewEyebrow: '질문 도우미',
        previewTitle: '자료 검색 · 질문 도우미 · 재배 솔루션',
        connected: '연결됨',
        pending: '대기',
        issue: '확인 필요',
        live: '실시간 요약',
        freshness: smartGrowLoading ? '질문 맥락 준비 중' : smartGrowError ?? '질문 도우미 연결됨',
        actionsEyebrow: '질문 전 확인',
        actionsTitle: '질문 전 확인할 4가지',
        comparisonEyebrow: '자료 기반 판단',
        comparisonTitle: '현재 질문 맥락과 자료 기반 솔루션',
        bridgeEyebrow: '질문 · 자료 · 솔루션 연결',
        bridgeTitle: '자료 검색에서 솔루션 도구로 이동',
        detailEyebrow: '세부 기능',
        detailTitle: '질문 도우미 전체 기능',
        detailDescription: '아래 세부 탭에서 질문, 자료 찾기, 농약·양액 솔루션을 각각 확인합니다.',
        ask: '질문',
        search: '자료 찾기',
        pesticide: '농약 솔루션',
        nutrient: '양액 솔루션',
        cropContext: '작물 맥락',
        market: '시세 맥락',
        model: '수확 전망',
        open: '열기',
        ready: '준비됨',
      }
    : {
        title: 'Knowledge',
        description: 'Keep chat, material lookup, pesticide, and nutrient tools connected to the backend.',
        heroBadge: 'Ask · Search · Solutions',
        heroTitle: 'Source-backed assistant for grower decisions',
        heroBody: 'Connect short questions to crop context, knowledge DB, pesticide tools, and nutrient correction workflows.',
        primary: 'Ask',
        secondary: 'Find Materials',
        previewEyebrow: 'KNOWLEDGE LIVE',
        previewTitle: 'RAG / Advisor / SmartGrow',
        connected: 'Connected',
        pending: 'Pending',
        issue: 'Check needed',
        live: 'Live Overview',
        freshness: smartGrowLoading ? 'Checking knowledge state' : smartGrowError ?? 'Knowledge backend connected',
        actionsEyebrow: 'Knowledge Action Board',
        actionsTitle: 'Four tools to open before acting',
        comparisonEyebrow: 'Knowledge Scenario',
        comparisonTitle: 'Question context vs source-backed solution',
        bridgeEyebrow: 'Ask · Search · Solution Bridge',
        bridgeTitle: 'Move from material lookup to solution tools',
        detailEyebrow: 'KNOWLEDGE FULL SURFACES',
        detailTitle: 'Full assistant workspace',
        detailDescription: 'The full chat, material search, compatibility, and SmartGrow solution surfaces stay below.',
        ask: 'Ask',
        search: 'Materials',
        pesticide: 'Pesticide tools',
        nutrient: 'Nutrient tools',
        cropContext: 'Crop context',
        market: 'Market context',
        model: 'Model context',
        open: 'Open',
        ready: 'Ready',
      };

  const metricsData: FeatureMetric[] = [
    {
      label: copy.cropContext,
      value: cropLabel,
      detail: locale === 'ko' ? `온도 ${formatNumber(currentData.temperature, 1)}°C` : `Temp ${formatNumber(currentData.temperature, 1)}°C`,
      trendLabel: `VPD ${formatNumber(currentData.vpd, 2)} kPa`,
      icon: Sprout,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'vpd', 24), currentData.vpd, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '작물 맥락 흐름' : 'Crop-context trend',
    },
    {
      label: 'CO2',
      value: formatNumber(currentData.co2, 0),
      unit: 'ppm',
      detail: `PAR ${formatNumber(latestLight, 0)}`,
      trendLabel: locale === 'ko' ? '센서 기준' : 'sensor',
      icon: Bot,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'co2', 24), currentData.co2, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '이산화탄소 흐름' : 'CO2 trend',
    },
    {
      label: copy.model,
      value: formatNumber(metrics.yield.predictedWeekly, 1),
      unit: locale === 'ko' ? 'kg/주' : 'kg/wk',
      detail: forecastHarvest
        ? (locale === 'ko' ? `${formatNumber(forecastHarvest, 1)} kg 예측` : `${formatNumber(forecastHarvest, 1)} kg forecast`)
        : (locale === 'ko' ? `신뢰도 ${Math.round(metrics.yield.confidence * 100)}%` : `${Math.round(metrics.yield.confidence * 100)}% confidence`),
      trendLabel: locale === 'ko' ? '예측' : 'model',
      icon: FlaskConical,
      tone: 'normal',
      series: mapNumericSeries(forecast?.daily, (day) => day.harvest_kg, 14),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '수확 예측 흐름' : 'Harvest forecast trend',
    },
    {
      label: copy.market,
      value: selectedMarket?.item ? formatNumber(selectedMarket.item.day_over_day_pct, 1) : '-',
      unit: selectedMarket?.item ? '%' : undefined,
      detail: selectedMarket?.item?.display_name ?? cropLabel,
      trend: selectedMarket?.item?.direction === 'down' ? 'down' : selectedMarket?.item?.direction === 'up' ? 'up' : 'stable',
      trendLabel: selectedMarket?.item ? (locale === 'ko' ? '도매 시세' : 'KAMIS') : copy.pending,
      icon: Search,
      tone: selectedMarket?.item ? 'normal' : 'muted',
      series: marketPriceSeries,
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '시세 흐름' : 'Market trend',
    },
    {
      label: locale === 'ko' ? '권장온도' : 'RTR',
      value: rtrProfile ? formatNumber(rtrProfile.baseTempC, 1) : '-',
      unit: rtrProfile ? '°C' : undefined,
      detail: rtrProfile?.strategyLabel ?? copy.pending,
      trendLabel: rtrProfile ? copy.connected : copy.pending,
      icon: ShieldCheck,
      tone: rtrProfile ? 'normal' : 'muted',
      series: rtrProfile ? appendFiniteValue(pickNumericSeries(history, 'temperature', 24), rtrProfile.baseTempC, 24) : [],
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '권장온도 기준 흐름' : 'RTR basis trend',
    },
    {
      label: locale === 'ko' ? '날씨' : 'Weather',
      value: weather ? formatNumber(weather.current.temperature_c, 1) : '-',
      unit: weather ? '°C' : undefined,
      detail: weather?.current.weather_label ?? copy.pending,
      trendLabel: weather ? copy.connected : copy.pending,
      icon: MessageCircle,
      tone: weather ? 'normal' : 'muted',
      series: appendFiniteValue(mapNumericSeries(weather?.daily, (day) => day.temperature_max_c, 10), weather?.current.temperature_c, 10),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '날씨 흐름' : 'Weather trend',
    },
  ];

  const actionCards: FeatureActionCard[] = [
    {
      title: copy.ask,
      body: locale === 'ko' ? '재배 질문을 현재 센서·모델·시세 맥락과 함께 상담합니다.' : 'Ask with current sensor, model, and market context attached.',
      chip: locale === 'ko' ? '질문 연결' : '/api/ai/chat',
      icon: MessageCircle,
      tone: 'normal',
      actionLabel: copy.open,
      onAction: onOpenAssistant,
    },
    {
      title: copy.search,
      body: locale === 'ko' ? '자료 찾기는 검색 형태를 유지하되 목차처럼 펼쳐 필요한 페이지로 이동합니다.' : 'Search materials while browsing source coverage like a table of contents.',
      chip: locale === 'ko' ? '자료 검색' : '/api/knowledge/query',
      icon: BookOpen,
      tone: 'normal',
      actionLabel: copy.open,
      href: '#assistant-search',
    },
    {
      title: copy.pesticide,
      body: pesticideReady ? '흰가루병, 온실가루이, 담배가루이, 노균병, 나방류 타겟별 교호 전략을 확인합니다.' : smartGrowError ?? '농약 추천 상태를 확인합니다.',
      chip: pesticideReady ? copy.ready : copy.issue,
      icon: ShieldCheck,
      tone: pesticideReady ? 'normal' : 'warning',
      actionLabel: copy.open,
      href: '#assistant-solutions',
    },
    {
      title: copy.nutrient,
      body: nutrientReady || nutrientCorrectionReady ? '기본 양액 추천과 원수·배액 기반 보정 초안을 확인합니다.' : '양액 추천 및 보정 상태를 확인합니다.',
      chip: nutrientReady || nutrientCorrectionReady ? copy.ready : copy.pending,
      icon: FlaskConical,
      tone: nutrientReady || nutrientCorrectionReady ? 'normal' : 'warning',
      actionLabel: copy.open,
      href: '#assistant-solutions',
    },
  ];

  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: copy.search,
      value: locale === 'ko' ? '목차 검색' : 'Source search',
      body: locale === 'ko'
        ? (summary?.advisorySurfaceNames.slice(0, 3).join(', ') || smartGrowError || '오이 재배 자료를 목차처럼 열어 필요한 내용만 확인합니다.')
        : (summary?.advisorySurfaceNames.slice(0, 3).join(', ') || smartGrowError || 'Browse crop materials like a table of contents.'),
      chip: smartGrowError ? copy.issue : copy.connected,
      chipTone: smartGrowError ? 'warning' : 'growth',
      icon: BookOpen,
      rows: [
        [locale === 'ko' ? '방식' : 'Mode', locale === 'ko' ? '검색·목차' : 'Search / TOC'],
        [cropLabel, summary?.cropKey ?? crop.toLowerCase()],
      ],
      actionLabel: copy.open,
      href: '#assistant-search',
    },
    {
      title: copy.ask,
      value: locale === 'ko' ? '질문 연결' : '/api/advisor/chat',
      body: locale === 'ko' ? '답변은 권고 요약, 이유, 조치 순서, 확인할 수치로 나뉘어 농민이 읽기 쉽게 표시됩니다.' : 'Answers are organized into summary, reason, next action, and values to check.',
      chip: copy.connected,
      chipTone: 'growth',
      icon: MessageCircle,
      rows: [
        [locale === 'ko' ? '온도' : 'Temp', `${formatNumber(currentData.temperature, 1)}°C`],
        ['CO2', `${formatNumber(currentData.co2, 0)} ppm`],
      ],
      actionLabel: copy.open,
      onAction: onOpenAssistant,
    },
    {
      title: locale === 'ko' ? '농약·양액 도구' : 'Agronomy tools',
      value: `${pesticideReady ? 1 : 0}/${nutrientReady || nutrientCorrectionReady ? 1 : 0}`,
      body: locale === 'ko' ? '농약 회전, 수동 검토 플래그, 양액 보정 초안과 제한 조건을 같은 흐름에서 봅니다.' : 'Review pesticide rotation, manual-review flags, and nutrient correction drafts together.',
      chip: locale === 'ko' ? '솔루션' : 'Tools',
      chipTone: pesticideReady || nutrientReady || nutrientCorrectionReady ? 'growth' : 'stable',
      icon: ShieldCheck,
      rows: [
        [copy.pesticide, locale === 'ko' ? '타깃별 추천' : 'Target guide'],
        [copy.nutrient, locale === 'ko' ? '보정 초안' : 'Correction draft'],
      ],
      actionLabel: copy.open,
      href: '#assistant-solutions',
    },
  ];

  return (
    <FeatureLandingFrame
      title={copy.title}
      description={copy.description}
      heroBadge={copy.heroBadge}
      heroTitle={copy.heroTitle}
      heroBody={copy.heroBody}
      primaryAction={{ label: copy.primary, onClick: onOpenAssistant }}
      secondaryAction={{ label: copy.secondary, href: '#assistant-search' }}
      preview={{
        eyebrow: copy.previewEyebrow,
        title: copy.previewTitle,
        statusLabel: smartGrowError ? copy.issue : summary ? copy.connected : copy.pending,
        statusTone: smartGrowError ? 'warning' : summary ? 'growth' : 'muted',
        metrics: [
          { label: copy.ask, value: locale === 'ko' ? '상담' : 'Chat' },
          { label: copy.search, value: locale === 'ko' ? '목차' : 'TOC' },
          { label: copy.pesticide, value: locale === 'ko' ? '타깃' : 'Target' },
        ],
        chartLabel: locale === 'ko' ? '질문 맥락 흐름' : 'Question context',
        chartStatus: locale === 'ko' ? '센서·시세·모델' : 'sensor / market / model',
        chartValues: [
          currentData.temperature,
          currentData.co2 / 20,
          latestLight / 10,
          metrics.yield.predictedWeekly,
        ],
      }}
      metricsEyebrow={copy.live}
      metricsFreshness={copy.freshness}
      metrics={metricsData}
      actionsEyebrow={copy.actionsEyebrow}
      actionsTitle={copy.actionsTitle}
      actions={actionCards}
      comparisonEyebrow={copy.comparisonEyebrow}
      comparisonTitle={copy.comparisonTitle}
      comparisonStatusLabel={smartGrowError ? copy.issue : summary ? copy.connected : copy.pending}
      comparisonStatusTone={smartGrowError ? 'warning' : summary ? 'growth' : 'muted'}
      comparisonNote={cropLabel}
      baseline={{
        title: locale === 'ko' ? '현재 질문 맥락' : 'Current question context',
        subtitle: locale === 'ko' ? '센서·모델·시세' : 'Sensor, model, and market',
        badgeCaption: locale === 'ko' ? '작물' : 'CROP',
        badgeLabel: cropLabel,
        rows: [
          [locale === 'ko' ? '온도' : 'Temp', `${formatNumber(currentData.temperature, 1)}°C`],
          ['CO2', `${formatNumber(currentData.co2, 0)} ppm`],
          [locale === 'ko' ? '습도 부담' : 'VPD', `${formatNumber(currentData.vpd, 2)} kPa`],
          [locale === 'ko' ? '수확' : 'Yield', `${formatNumber(metrics.yield.predictedWeekly, 1)} ${locale === 'ko' ? 'kg/주' : 'kg/wk'}`],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '도구 선택' : 'Tool selection',
        subtitle: locale === 'ko' ? '자료 검색·질문 도우미·농약·양액' : 'Materials, assistant, pesticide, and nutrients',
        badgeCaption: locale === 'ko' ? '도구' : 'TOOLS',
        badgeLabel: locale === 'ko' ? '질문·솔루션' : 'Ask / tools',
        rows: [
          [copy.search, locale === 'ko' ? '목차 검색' : 'TOC search'],
          [copy.pesticide, locale === 'ko' ? '타깃별 추천' : 'Target guide'],
          [copy.nutrient, locale === 'ko' ? '보정 초안' : 'Correction draft'],
          [locale === 'ko' ? '온도 기준' : 'RTR', rtrProfile ? formatNumber(rtrProfile.baseTempC, 1) + '°C' : copy.pending],
        ],
      }}
      bridgeEyebrow={copy.bridgeEyebrow}
      bridgeTitle={copy.bridgeTitle}
      bridgeCards={bridgeCards}
      detailEyebrow={copy.detailEyebrow}
      detailTitle={copy.detailTitle}
      detailDescription={copy.detailDescription}
      sectionTabs={sectionTabs}
      activeSectionId={activeSectionId}
      onSelectSection={onSelectSection}
      onOpenAssistant={onOpenAssistant}
    >
      <div
        id="assistant-workspace"
        className={summaryRail
          ? 'grid gap-6 scroll-mt-24 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,392px)]'
          : 'scroll-mt-24 space-y-6'}
      >
        <div className="min-w-0">{surface}</div>
        {summaryRail ? <div className="min-w-0">{summaryRail}</div> : null}
      </div>
    </FeatureLandingFrame>
  );
}
