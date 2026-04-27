import type { ReactNode } from 'react';
import { CircleDollarSign, CloudSun, LifeBuoy, MessageCircle, PlugZap, Settings, ShieldCheck, WalletCards } from 'lucide-react';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
} from '../components/dashboard/FeatureLandingFrame';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { CropType, ProducePricesPayload, WeatherOutlook } from '../types';

interface SettingsPageProps {
  locale: 'ko' | 'en';
  crop: CropType;
  selectedCropLabel: string;
  assistantOpen: boolean;
  telemetrySummary: string;
  weatherConnected: boolean;
  marketConnected: boolean;
  pricePerKg: string;
  costPerKwh: string;
  loadState: 'loading' | 'loaded' | 'error';
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  weather?: WeatherOutlook | null;
  producePrices?: ProducePricesPayload | null;
  knowledgeSummary?: SmartGrowKnowledgeSummary | null;
  shellCard: ReactNode;
  laneCard: ReactNode;
  supportCard?: ReactNode;
  onOpenAssistant: () => void;
}

function formatNumber(value: number | string | null | undefined, digits = 0): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
    return '-';
  }
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function SettingsPage({
  locale,
  crop,
  selectedCropLabel,
  assistantOpen,
  telemetrySummary,
  weatherConnected,
  marketConnected,
  pricePerKg,
  costPerKwh,
  loadState,
  saveState,
  weather = null,
  producePrices = null,
  knowledgeSummary = null,
  shellCard,
  laneCard,
  supportCard,
  onOpenAssistant,
}: SettingsPageProps) {
  const readySurfaceCount = knowledgeSummary?.surfaces.filter((surface) => surface.status === 'ready').length ?? 0;
  const marketLatestDay = producePrices?.source?.latest_day ?? null;
  const settingsReady = loadState === 'loaded';
  const saveReady = saveState === 'saved' || saveState === 'idle';

  const copy = locale === 'ko'
    ? {
        title: 'Contact',
        description: '센서·날씨·시세 연결, 작물별 비용 기준, 운영 문의 맥락을 한 화면에서 정리합니다.',
        heroBadge: '연동 · 설정 · 지원',
        heroTitle: '운영 문의 전에 연결과 비용 기준을 정리',
        heroBody: '문의 화면을 단순 연락처가 아니라 백엔드 설정 API, 연결 상태, 질문 도우미 맥락을 확인하는 운영 지원 화면으로 구성합니다.',
        primary: '설정 저장 영역',
        secondary: '질문 도우미',
        previewEyebrow: 'CONTACT LIVE',
        previewTitle: 'Settings / API / Support',
        connected: '연결됨',
        pending: '대기',
        issue: '확인 필요',
        saved: '저장됨',
        loading: '불러오는 중',
        live: 'Live Overview',
        freshness: settingsReady ? '설정 API 반영됨' : '설정 API 확인 중',
        actionsEyebrow: 'Contact Action Board',
        actionsTitle: '지원 요청 전 확인할 4가지',
        comparisonEyebrow: 'Operating Basis',
        comparisonTitle: '연동 상태와 저장 기준 비교',
        bridgeEyebrow: '설정 · 연결 · 문의 연결',
        bridgeTitle: '지원 흐름에 필요한 상태를 한곳에서 정리',
        detailEyebrow: 'CONTACT FULL SURFACES',
        detailTitle: '연동 상태와 설정 전체 기능',
        detailDescription: '아래는 기존 settings API 저장, 연결 상태, 지원 준비 카드를 보존한 전체 기능 영역입니다.',
        sensor: '센서',
        weather: '기상',
        market: '시장',
        assistant: '질문 도우미',
        price: '판매가',
        power: '전력 단가',
        crop: '작물',
        open: '열기',
      }
    : {
        title: 'Contact',
        description: 'Review sensor, weather, market, cost assumptions, and support context.',
        heroBadge: 'Connectivity · Settings · Support',
        heroTitle: 'Collect links and operating basis before support',
        heroBody: 'Treat contact as a backend settings and support-readiness surface, not a generic contact page.',
        primary: 'Open Settings',
        secondary: 'Ask Assistant',
        previewEyebrow: 'CONTACT LIVE',
        previewTitle: 'Settings / API / Support',
        connected: 'Connected',
        pending: 'Pending',
        issue: 'Check needed',
        saved: 'Saved',
        loading: 'Loading',
        live: 'Live Overview',
        freshness: settingsReady ? 'Settings API loaded' : 'Checking settings API',
        actionsEyebrow: 'Contact Action Board',
        actionsTitle: 'Four checks before support',
        comparisonEyebrow: 'Operating Basis',
        comparisonTitle: 'Connection state vs saved assumptions',
        bridgeEyebrow: 'Settings · Connection · Support Bridge',
        bridgeTitle: 'Keep support context in one place',
        detailEyebrow: 'CONTACT FULL SURFACES',
        detailTitle: 'Full connectivity and settings workspace',
        detailDescription: 'The full settings API save flow, connection state, and support cards remain below.',
        sensor: 'Sensor',
        weather: 'Weather',
        market: 'Market',
        assistant: 'Assistant',
        price: 'Price',
        power: 'Power cost',
        crop: 'Crop',
        open: 'Open',
      };

  const metrics: FeatureMetric[] = [
    {
      label: copy.sensor,
      value: telemetrySummary,
      detail: 'WS / status',
      trendLabel: telemetrySummary,
      icon: PlugZap,
      tone: telemetrySummary.toLowerCase().includes('offline') || telemetrySummary.includes('끊김') ? 'critical' : 'normal',
    },
    {
      label: copy.weather,
      value: weatherConnected ? copy.connected : copy.pending,
      detail: weather?.current.weather_label ?? '/api/weather/daegu',
      trendLabel: weatherConnected ? copy.connected : copy.issue,
      icon: CloudSun,
      tone: weatherConnected ? 'normal' : 'warning',
    },
    {
      label: copy.market,
      value: marketConnected ? copy.connected : copy.pending,
      detail: marketLatestDay ?? 'KAMIS',
      trendLabel: marketConnected ? copy.connected : copy.issue,
      icon: CircleDollarSign,
      tone: marketConnected ? 'normal' : 'warning',
    },
    {
      label: copy.price,
      value: formatNumber(pricePerKg),
      unit: 'KRW/kg',
      detail: selectedCropLabel,
      trendLabel: saveState === 'saved' ? copy.saved : settingsReady ? copy.connected : copy.loading,
      icon: WalletCards,
      tone: settingsReady ? 'normal' : 'muted',
    },
    {
      label: copy.power,
      value: formatNumber(costPerKwh),
      unit: 'KRW/kWh',
      detail: 'RTR cost basis',
      trendLabel: saveState === 'error' ? copy.issue : saveReady ? copy.connected : copy.loading,
      icon: Settings,
      tone: saveState === 'error' ? 'warning' : saveReady ? 'normal' : 'muted',
    },
    {
      label: copy.assistant,
      value: assistantOpen ? copy.connected : copy.pending,
      detail: 'RAG / chat',
      trendLabel: assistantOpen ? copy.open : copy.pending,
      icon: MessageCircle,
      tone: assistantOpen ? 'normal' : 'muted',
    },
    {
      label: 'Knowledge',
      value: knowledgeSummary ? `${readySurfaceCount}/${knowledgeSummary.surfaces.length}` : '-',
      detail: 'SmartGrow',
      trendLabel: knowledgeSummary ? copy.connected : copy.pending,
      icon: ShieldCheck,
      tone: knowledgeSummary ? 'normal' : 'muted',
    },
  ];

  const actionCards: FeatureActionCard[] = [
    {
      title: copy.sensor,
      body: locale === 'ko' ? `현재 텔레메트리 상태는 ${telemetrySummary}입니다. 문의 전에 마지막 갱신 상태를 확인합니다.` : `Current telemetry state is ${telemetrySummary}. Check freshness before support.`,
      chip: telemetrySummary,
      icon: PlugZap,
      tone: telemetrySummary.toLowerCase().includes('offline') || telemetrySummary.includes('끊김') ? 'critical' : 'normal',
      actionLabel: copy.open,
      href: '#contact-settings',
    },
    {
      title: copy.weather,
      body: weatherConnected ? (weather?.summary ?? 'Weather feed is available for operating context.') : 'Weather feed is pending or unavailable.',
      chip: weatherConnected ? copy.connected : copy.issue,
      icon: CloudSun,
      tone: weatherConnected ? 'normal' : 'warning',
      actionLabel: copy.open,
      to: '/trend',
    },
    {
      title: copy.market,
      body: marketConnected ? `${producePrices?.summary ?? 'KAMIS produce price feed is available.'}` : 'KAMIS produce price feed is pending or unavailable.',
      chip: marketConnected ? copy.connected : copy.issue,
      icon: CircleDollarSign,
      tone: marketConnected ? 'normal' : 'warning',
      actionLabel: copy.open,
      to: '/trend',
    },
    {
      title: copy.assistant,
      body: locale === 'ko' ? '운영 문의 전 질문 도우미에서 현재 맥락과 자료 검색 결과를 정리합니다.' : 'Use the assistant to collect current context and source lookup before support.',
      chip: assistantOpen ? copy.open : copy.pending,
      icon: MessageCircle,
      tone: 'normal',
      actionLabel: copy.open,
      onAction: onOpenAssistant,
    },
  ];

  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: locale === 'ko' ? '설정 API' : 'Settings API',
      value: settingsReady ? copy.connected : copy.pending,
      body: locale === 'ko' ? `${selectedCropLabel} 판매가와 전력 단가를 /api/settings에 저장해 RTR·시세 판단 기준으로 사용합니다.` : `${selectedCropLabel} price and power cost are saved through /api/settings.`,
      chip: saveState === 'error' || loadState === 'error' ? copy.issue : settingsReady ? copy.connected : copy.pending,
      chipTone: saveState === 'error' || loadState === 'error' ? 'warning' : settingsReady ? 'growth' : 'muted',
      icon: Settings,
      rows: [
        [copy.price, `${formatNumber(pricePerKg)} KRW/kg`],
        [copy.power, `${formatNumber(costPerKwh)} KRW/kWh`],
      ],
      actionLabel: copy.open,
      href: '#contact-settings',
    },
    {
      title: locale === 'ko' ? '연동 상태' : 'Connection state',
      value: weatherConnected && marketConnected ? copy.connected : copy.issue,
      body: locale === 'ko' ? `기상 ${weatherConnected ? copy.connected : copy.pending}, 시장 ${marketConnected ? copy.connected : copy.pending}, 센서 ${telemetrySummary}.` : `Weather ${weatherConnected ? 'connected' : 'pending'}, market ${marketConnected ? 'connected' : 'pending'}, sensor ${telemetrySummary}.`,
      chip: weatherConnected && marketConnected ? copy.connected : copy.issue,
      chipTone: weatherConnected && marketConnected ? 'growth' : 'warning',
      icon: CloudSun,
      rows: [
        [copy.weather, weatherConnected ? copy.connected : copy.pending],
        [copy.market, marketConnected ? copy.connected : copy.pending],
      ],
      actionLabel: copy.open,
      to: '/trend',
    },
    {
      title: locale === 'ko' ? '문의 준비' : 'Support readiness',
      value: assistantOpen ? copy.open : copy.pending,
      body: locale === 'ko' ? '질문 도우미와 연결 상태를 함께 열어 문제 설명을 정리합니다.' : 'Keep assistant context and connection state ready for support follow-up.',
      chip: knowledgeSummary ? copy.connected : copy.pending,
      chipTone: knowledgeSummary ? 'growth' : 'muted',
      icon: LifeBuoy,
      rows: [
        [copy.assistant, assistantOpen ? copy.open : copy.pending],
        ['Knowledge', knowledgeSummary ? `${readySurfaceCount}/${knowledgeSummary.surfaces.length}` : '-'],
      ],
      actionLabel: copy.open,
      onAction: onOpenAssistant,
    },
  ];

  return (
    <FeatureLandingFrame
      title={copy.title}
      description={copy.description}
      heroBadge={copy.heroBadge}
      heroTitle={copy.heroTitle}
      heroBody={copy.heroBody}
      primaryAction={{ label: copy.primary, href: '#contact-settings' }}
      secondaryAction={{ label: copy.secondary, onClick: onOpenAssistant }}
      preview={{
        eyebrow: copy.previewEyebrow,
        title: copy.previewTitle,
        statusLabel: settingsReady ? copy.connected : copy.pending,
        statusTone: settingsReady ? 'growth' : 'warning',
        metrics: [
          { label: copy.crop, value: selectedCropLabel },
          { label: copy.price, value: formatNumber(pricePerKg), detail: 'KRW/kg' },
          { label: copy.power, value: formatNumber(costPerKwh), detail: 'KRW/kWh' },
        ],
        chartLabel: locale === 'ko' ? '연동 준비도' : 'Connection readiness',
        chartStatus: weatherConnected && marketConnected ? copy.connected : copy.issue,
        chartValues: [
          telemetrySummary.toLowerCase().includes('offline') ? 0 : 1,
          weatherConnected ? 1 : 0,
          marketConnected ? 1 : 0,
          settingsReady ? 1 : 0,
          knowledgeSummary ? readySurfaceCount : 0,
        ],
      }}
      metricsEyebrow={copy.live}
      metricsFreshness={copy.freshness}
      metrics={metrics}
      actionsEyebrow={copy.actionsEyebrow}
      actionsTitle={copy.actionsTitle}
      actions={actionCards}
      comparisonEyebrow={copy.comparisonEyebrow}
      comparisonTitle={copy.comparisonTitle}
      comparisonStatusLabel={settingsReady ? copy.connected : copy.pending}
      comparisonStatusTone={settingsReady ? 'growth' : 'warning'}
      comparisonNote={selectedCropLabel}
      baseline={{
        title: locale === 'ko' ? '연동 상태' : 'Connection state',
        subtitle: locale === 'ko' ? '센서·날씨·시장' : 'Sensor, weather, and market',
        badgeCaption: 'LIVE',
        badgeLabel: weatherConnected && marketConnected ? copy.connected : copy.issue,
        rows: [
          [copy.sensor, telemetrySummary],
          [copy.weather, weatherConnected ? copy.connected : copy.pending],
          [copy.market, marketConnected ? copy.connected : copy.pending],
          [copy.assistant, assistantOpen ? copy.open : copy.pending],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '저장 기준' : 'Saved basis',
        subtitle: locale === 'ko' ? '작물별 비용과 지원 맥락' : 'Crop cost and support context',
        badgeCaption: 'SETTINGS',
        badgeLabel: settingsReady ? copy.connected : copy.pending,
        rows: [
          [copy.crop, selectedCropLabel],
          [copy.price, `${formatNumber(pricePerKg)} KRW/kg`],
          [copy.power, `${formatNumber(costPerKwh)} KRW/kWh`],
          ['Crop key', crop.toLowerCase()],
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
      <div id="contact-settings" className="grid gap-6 scroll-mt-24 xl:grid-cols-2">
        <div className="min-w-0">{shellCard}</div>
        <div className="min-w-0">{laneCard}</div>
        {supportCard ? <div className="min-w-0 xl:col-span-2">{supportCard}</div> : null}
      </div>
    </FeatureLandingFrame>
  );
}
