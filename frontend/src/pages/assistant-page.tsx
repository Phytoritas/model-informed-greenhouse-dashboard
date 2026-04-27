import type { ReactNode } from 'react';
import { BookOpen, Bot, FlaskConical, MessageCircle, Search, ShieldCheck, Sprout } from 'lucide-react';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
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
  surface,
  summaryRail = null,
  onOpenAssistant,
}: AssistantPageProps) {
  const readySurfaceCount = summary?.surfaces.filter((surfaceSummary) => surfaceSummary.status === 'ready').length ?? 0;
  const selectedMarket = selectProduceItemForCrop(producePrices, crop, {
    marketPreference: ['wholesale', 'retail'],
    enforcePreferredVariant: true,
  });
  const pesticideReady = summary?.pesticideReady === true;
  const nutrientReady = summary?.nutrientReady === true;
  const nutrientCorrectionReady = summary?.nutrientCorrectionReady === true;
  const latestLight = history.at(-1)?.light ?? currentData.light;
  const forecastHarvest = forecast?.total_harvest_kg;

  const copy = locale === 'ko'
    ? {
        title: 'Knowledge',
        description: '질문 도우미, 자료 목차 검색, 농약·양액 솔루션을 한 화면에서 실제 백엔드 기능으로 확인합니다.',
        heroBadge: '질문 · 자료 · 솔루션',
        heroTitle: '농민이 바로 이해하는 자료 기반 질문 도우미',
        heroBody: '짧은 질문을 재배 맥락, 지식 DB, 농약·양액 도구와 연결해 근거가 보이는 권고 형태로 정리합니다.',
        primary: '질문하기',
        secondary: '자료 찾기',
        previewEyebrow: 'KNOWLEDGE LIVE',
        previewTitle: 'RAG / Advisor / SmartGrow',
        connected: '연결됨',
        pending: '대기',
        issue: '확인 필요',
        live: 'Live Overview',
        freshness: smartGrowLoading ? '지식 상태 확인 중' : smartGrowError ?? 'Knowledge backend connected',
        actionsEyebrow: 'Knowledge Action Board',
        actionsTitle: '질문 전 확인할 4가지',
        comparisonEyebrow: 'Knowledge Scenario',
        comparisonTitle: '현재 질문 맥락과 자료 기반 솔루션',
        bridgeEyebrow: '질문 · 자료 · 솔루션 연결',
        bridgeTitle: '자료 검색에서 솔루션 도구로 이동',
        detailEyebrow: 'KNOWLEDGE FULL SURFACES',
        detailTitle: '질문 도우미 전체 기능',
        detailDescription: '아래는 기존 채팅, 자료 검색, 호환성 분석, SmartGrow 솔루션 패널을 보존한 전체 기능 영역입니다.',
        ask: '질문',
        search: '자료 찾기',
        pesticide: '농약 솔루션',
        nutrient: '양액 솔루션',
        readySurfaces: '준비 표면',
        cropContext: '작물 맥락',
        market: '시세 맥락',
        model: '모델 맥락',
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
        readySurfaces: 'Ready surfaces',
        cropContext: 'Crop context',
        market: 'Market context',
        model: 'Model context',
        open: 'Open',
        ready: 'Ready',
      };

  const metricsData: FeatureMetric[] = [
    {
      label: copy.readySurfaces,
      value: summary ? `${readySurfaceCount}/${summary.surfaces.length}` : '-',
      detail: smartGrowLoading ? copy.pending : smartGrowError ?? 'SmartGrow',
      trendLabel: smartGrowError ? copy.issue : summary ? copy.connected : copy.pending,
      icon: BookOpen,
      tone: smartGrowError ? 'warning' : summary ? 'normal' : 'muted',
    },
    {
      label: copy.cropContext,
      value: cropLabel,
      detail: `Temp ${formatNumber(currentData.temperature, 1)}°C`,
      trendLabel: `VPD ${formatNumber(currentData.vpd, 2)} kPa`,
      icon: Sprout,
      tone: 'normal',
    },
    {
      label: 'CO2',
      value: formatNumber(currentData.co2, 0),
      unit: 'ppm',
      detail: `PAR ${formatNumber(latestLight, 0)}`,
      trendLabel: 'sensor',
      icon: Bot,
      tone: 'normal',
    },
    {
      label: copy.model,
      value: formatNumber(metrics.yield.predictedWeekly, 1),
      unit: 'kg/wk',
      detail: forecastHarvest ? `${formatNumber(forecastHarvest, 1)} kg forecast` : `${Math.round(metrics.yield.confidence * 100)}% confidence`,
      trendLabel: 'model',
      icon: FlaskConical,
      tone: 'normal',
    },
    {
      label: copy.market,
      value: selectedMarket?.item ? formatNumber(selectedMarket.item.day_over_day_pct, 1) : '-',
      unit: selectedMarket?.item ? '%' : undefined,
      detail: selectedMarket?.item?.display_name ?? cropLabel,
      trend: selectedMarket?.item?.direction === 'down' ? 'down' : selectedMarket?.item?.direction === 'up' ? 'up' : 'stable',
      trendLabel: selectedMarket?.item ? 'KAMIS' : copy.pending,
      icon: Search,
      tone: selectedMarket?.item ? 'normal' : 'muted',
    },
    {
      label: 'RTR',
      value: rtrProfile ? formatNumber(rtrProfile.baseTempC, 1) : '-',
      unit: rtrProfile ? '°C' : undefined,
      detail: rtrProfile?.strategyLabel ?? copy.pending,
      trendLabel: rtrProfile ? copy.connected : copy.pending,
      icon: ShieldCheck,
      tone: rtrProfile ? 'normal' : 'muted',
    },
    {
      label: 'Weather',
      value: weather ? formatNumber(weather.current.temperature_c, 1) : '-',
      unit: weather ? '°C' : undefined,
      detail: weather?.current.weather_label ?? copy.pending,
      trendLabel: weather ? copy.connected : copy.pending,
      icon: MessageCircle,
      tone: weather ? 'normal' : 'muted',
    },
  ];

  const actionCards: FeatureActionCard[] = [
    {
      title: copy.ask,
      body: locale === 'ko' ? '재배 질문을 현재 센서·모델·시세 맥락과 함께 상담합니다.' : 'Ask with current sensor, model, and market context attached.',
      chip: '/api/ai/chat',
      icon: MessageCircle,
      tone: 'normal',
      actionLabel: copy.open,
      onAction: onOpenAssistant,
    },
    {
      title: copy.search,
      body: locale === 'ko' ? '자료 찾기는 검색 형태를 유지하되 목차처럼 펼쳐 필요한 페이지로 이동합니다.' : 'Search materials while browsing source coverage like a table of contents.',
      chip: '/api/knowledge/query',
      icon: BookOpen,
      tone: 'normal',
      actionLabel: copy.open,
      href: '#assistant-search',
    },
    {
      title: copy.pesticide,
      body: pesticideReady ? '흰가루병, 온실가루이, 담배가루이, 노균병, 나방류 타겟별 교호 전략을 확인합니다.' : smartGrowError ?? '농약 추천 surface 상태를 확인합니다.',
      chip: pesticideReady ? copy.ready : copy.issue,
      icon: ShieldCheck,
      tone: pesticideReady ? 'normal' : 'warning',
      actionLabel: copy.open,
      href: '#assistant-search',
    },
    {
      title: copy.nutrient,
      body: nutrientReady || nutrientCorrectionReady ? '기본 양액 추천과 원수·배액 기반 보정 초안을 확인합니다.' : '양액 추천 및 보정 surface 상태를 확인합니다.',
      chip: nutrientReady || nutrientCorrectionReady ? copy.ready : copy.pending,
      icon: FlaskConical,
      tone: nutrientReady || nutrientCorrectionReady ? 'normal' : 'warning',
      actionLabel: copy.open,
      href: '#assistant-search',
    },
  ];

  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: copy.search,
      value: summary ? `${readySurfaceCount}/${summary.surfaces.length}` : copy.pending,
      body: summary?.advisorySurfaceNames.slice(0, 3).join(', ') || smartGrowError || 'Knowledge DB readiness and source coverage are checked here.',
      chip: smartGrowError ? copy.issue : copy.connected,
      chipTone: smartGrowError ? 'warning' : 'growth',
      icon: BookOpen,
      rows: [
        [copy.readySurfaces, summary ? `${readySurfaceCount}/${summary.surfaces.length}` : '-'],
        [cropLabel, summary?.cropKey ?? crop.toLowerCase()],
      ],
      actionLabel: copy.open,
      href: '#assistant-search',
    },
    {
      title: copy.ask,
      value: '/api/advisor/chat',
      body: locale === 'ko' ? '답변은 권고 요약, 이유, 조치 순서, 확인할 수치로 나뉘어 농민이 읽기 쉽게 표시됩니다.' : 'Answers are organized into summary, reason, next action, and values to check.',
      chip: copy.connected,
      chipTone: 'growth',
      icon: MessageCircle,
      rows: [
        ['Temp', `${formatNumber(currentData.temperature, 1)}°C`],
        ['CO2', `${formatNumber(currentData.co2, 0)} ppm`],
      ],
      actionLabel: copy.open,
      onAction: onOpenAssistant,
    },
    {
      title: locale === 'ko' ? '농약·양액 도구' : 'Agronomy tools',
      value: `${pesticideReady ? 1 : 0}/${nutrientReady || nutrientCorrectionReady ? 1 : 0}`,
      body: locale === 'ko' ? '농약 회전, 수동 검토 플래그, 양액 보정 초안과 제한 조건을 같은 흐름에서 봅니다.' : 'Review pesticide rotation, manual-review flags, and nutrient correction drafts together.',
      chip: pesticideReady || nutrientReady || nutrientCorrectionReady ? copy.ready : copy.pending,
      chipTone: pesticideReady || nutrientReady || nutrientCorrectionReady ? 'growth' : 'warning',
      icon: ShieldCheck,
      rows: [
        [copy.pesticide, pesticideReady ? copy.ready : copy.pending],
        [copy.nutrient, nutrientReady || nutrientCorrectionReady ? copy.ready : copy.pending],
      ],
      actionLabel: copy.open,
      href: '#assistant-search',
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
          { label: copy.readySurfaces, value: summary ? `${readySurfaceCount}/${summary.surfaces.length}` : '-' },
          { label: copy.pesticide, value: pesticideReady ? copy.ready : copy.pending },
          { label: copy.nutrient, value: nutrientReady || nutrientCorrectionReady ? copy.ready : copy.pending },
        ],
        chartLabel: locale === 'ko' ? '자료 준비도' : 'Knowledge readiness',
        chartStatus: summary ? `${readySurfaceCount} ready` : copy.pending,
        chartValues: [
          pesticideReady ? 1 : 0,
          nutrientReady ? 1 : 0,
          nutrientCorrectionReady ? 1 : 0,
          readySurfaceCount,
          summary?.surfaces.length ?? 0,
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
        badgeCaption: 'CROP',
        badgeLabel: cropLabel,
        rows: [
          ['Temp', `${formatNumber(currentData.temperature, 1)}°C`],
          ['CO2', `${formatNumber(currentData.co2, 0)} ppm`],
          ['VPD', `${formatNumber(currentData.vpd, 2)} kPa`],
          ['Yield', `${formatNumber(metrics.yield.predictedWeekly, 1)} kg/wk`],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '자료 기반 솔루션' : 'Source-backed solution',
        subtitle: locale === 'ko' ? 'RAG·Advisor·SmartGrow' : 'RAG, Advisor, and SmartGrow',
        badgeCaption: 'READY',
        badgeLabel: summary ? `${readySurfaceCount}/${summary.surfaces.length}` : copy.pending,
        rows: [
          [copy.search, summary ? copy.connected : copy.pending],
          [copy.pesticide, pesticideReady ? copy.ready : copy.pending],
          [copy.nutrient, nutrientReady || nutrientCorrectionReady ? copy.ready : copy.pending],
          ['RTR', rtrProfile ? copy.connected : copy.pending],
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
      <div id="assistant-search" className="grid gap-6 scroll-mt-24 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,392px)]">
        <div className="min-w-0">{surface}</div>
        {summaryRail ? <div className="min-w-0">{summaryRail}</div> : null}
      </div>
    </FeatureLandingFrame>
  );
}
