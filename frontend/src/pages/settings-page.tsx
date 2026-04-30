import { useState, type ReactNode } from 'react';
import { CircleDollarSign, CloudSun, LifeBuoy, MessageCircle, PlugZap, Settings, WalletCards } from 'lucide-react';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
} from '../components/dashboard/FeatureLandingFrame';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { CropType, ProducePricesPayload, WeatherOutlook } from '../types';
import { mapNumericSeries } from '../utils/metricTrendSeries';

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
  tabs?: Array<{ id: string; label: string }>;
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
  onOpenAssistant: () => void;
}

type ContactPanelId = 'contact-settings' | 'contact-connections' | 'contact-support';

function isContactPanelId(value: string | undefined): value is ContactPanelId {
  return value === 'contact-settings' || value === 'contact-connections' || value === 'contact-support';
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
  shellCard,
  laneCard,
  supportCard,
  tabs = [],
  activeTabId,
  onSelectTab,
  onOpenAssistant,
}: SettingsPageProps) {
  const [localActivePanel, setLocalActivePanel] = useState<ContactPanelId>('contact-settings');
  const marketLatestDay = producePrices?.source?.latest_day ?? null;
  const settingsReady = loadState === 'loaded';
  const saveReady = saveState === 'saved' || saveState === 'idle';
  const statusSeries = [
    settingsReady ? 1 : 0,
    weatherConnected ? 1 : 0,
    marketConnected ? 1 : 0,
    assistantOpen ? 1 : 0,
  ];
  const marketSeries = mapNumericSeries(producePrices?.trend?.series[0]?.points, (point) => point.actual_price_krw, 24);

  const copy = locale === 'ko'
    ? {
        title: '연동 문의',
        description: '센서·날씨·시세 연결, 작물별 비용 기준, 운영 문의 맥락을 한 화면에서 정리합니다.',
        heroBadge: '연동 · 설정 · 지원',
        heroTitle: '운영 문의 전에 연결과 비용 기준을 정리',
        heroBody: '문의 화면을 단순 연락처가 아니라 연결 상태, 비용 기준, 질문 도우미 맥락을 확인하는 운영 지원 화면으로 구성합니다.',
        primary: '운영 기준',
        secondary: '질문 도우미',
        previewEyebrow: '연동 현황',
        previewTitle: '설정 · 연결 · 지원',
        connected: '연결됨',
        pending: '대기',
        issue: '확인 필요',
        saved: '저장됨',
        loading: '불러오는 중',
        live: '실시간 요약',
        freshness: settingsReady ? '설정 반영됨' : '설정 확인 중',
        actionsEyebrow: '지원 전 확인',
        actionsTitle: '지원 요청 전 확인할 4가지',
        comparisonEyebrow: '운영 기준',
        comparisonTitle: '연동 상태와 저장 기준 비교',
        bridgeEyebrow: '설정 · 연결 · 문의 연결',
        bridgeTitle: '지원 흐름에 필요한 상태를 한곳에서 정리',
        detailEyebrow: '세부 기능',
        detailTitle: '운영 기준 · 연결 상태 · 문의 준비',
        detailDescription: '아래 세부 탭에서 저장 기준, 연결 상태, 문의 준비 항목을 나눠 확인합니다.',
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
      detail: locale === 'ko' ? '상태 확인' : 'WS / status',
      trendLabel: telemetrySummary,
      icon: PlugZap,
      tone: telemetrySummary.toLowerCase().includes('offline') || telemetrySummary.includes('끊김') ? 'critical' : 'normal',
      series: statusSeries,
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '연결 상태 흐름' : 'Connection status signal',
    },
    {
      label: copy.weather,
      value: weatherConnected ? copy.connected : copy.pending,
      detail: weather?.current.weather_label ?? (locale === 'ko' ? '대구 날씨' : '/api/weather/daegu'),
      trendLabel: weatherConnected ? copy.connected : copy.issue,
      icon: CloudSun,
      tone: weatherConnected ? 'normal' : 'warning',
      series: mapNumericSeries(weather?.daily, (day) => day.temperature_max_c, 10),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '날씨 연결 흐름' : 'Weather trend',
    },
    {
      label: copy.market,
      value: marketConnected ? copy.connected : copy.pending,
      detail: marketLatestDay ?? (locale === 'ko' ? '도매 시세' : 'KAMIS'),
      trendLabel: marketConnected ? copy.connected : copy.issue,
      icon: CircleDollarSign,
      tone: marketConnected ? 'normal' : 'warning',
      series: marketSeries,
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '시세 연결 흐름' : 'Market trend',
    },
    {
      label: copy.price,
      value: formatNumber(pricePerKg),
      unit: locale === 'ko' ? '원/kg' : 'KRW/kg',
      detail: selectedCropLabel,
      trendLabel: saveState === 'saved' ? copy.saved : settingsReady ? copy.connected : copy.loading,
      icon: WalletCards,
      tone: settingsReady ? 'normal' : 'muted',
      series: [Number(pricePerKg)].filter((value) => Number.isFinite(value)),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? 'kg당 기준가' : 'Price setting',
    },
    {
      label: copy.power,
      value: formatNumber(costPerKwh),
      unit: locale === 'ko' ? '원/kWh' : 'KRW/kWh',
      detail: locale === 'ko' ? '전력비 기준' : 'RTR cost basis',
      trendLabel: saveState === 'error' ? copy.issue : saveReady ? copy.connected : copy.loading,
      icon: Settings,
      tone: saveState === 'error' ? 'warning' : saveReady ? 'normal' : 'muted',
      series: [Number(costPerKwh)].filter((value) => Number.isFinite(value)),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '전력비 기준' : 'Power-cost setting',
    },
    {
      label: copy.assistant,
      value: assistantOpen ? copy.connected : copy.pending,
      detail: locale === 'ko' ? '질문·자료' : 'RAG / chat',
      trendLabel: assistantOpen ? copy.open : copy.pending,
      icon: MessageCircle,
      tone: assistantOpen ? 'normal' : 'muted',
      series: [assistantOpen ? 1 : 0, assistantOpen ? 1 : 0],
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '질문 도우미 상태' : 'Assistant state',
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
      body: locale === 'ko'
        ? (weatherConnected ? (weather?.summary ?? '기상 정보가 운영 판단에 연결되어 있습니다.') : '기상 정보를 확인해야 합니다.')
        : (weatherConnected ? (weather?.summary ?? 'Weather feed is available for operating context.') : 'Weather feed is pending or unavailable.'),
      chip: weatherConnected ? copy.connected : copy.issue,
      icon: CloudSun,
      tone: weatherConnected ? 'normal' : 'warning',
      actionLabel: copy.open,
      to: '/trend',
    },
    {
      title: copy.market,
      body: locale === 'ko'
        ? (marketConnected ? `${producePrices?.summary ?? '도매 시세 정보가 연결되어 있습니다.'}` : '도매 시세 정보를 확인해야 합니다.')
        : (marketConnected ? `${producePrices?.summary ?? 'KAMIS produce price feed is available.'}` : 'KAMIS produce price feed is pending or unavailable.'),
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
      title: locale === 'ko' ? '운영 기준' : 'Settings API',
      value: settingsReady ? copy.connected : copy.pending,
      body: locale === 'ko' ? `${selectedCropLabel} 판매가와 전력 단가를 저장해 온도 기준 검토와 시세 판단에 같은 기준으로 사용합니다.` : `${selectedCropLabel} price and power cost are saved through /api/settings.`,
      chip: saveState === 'error' || loadState === 'error' ? copy.issue : settingsReady ? copy.connected : copy.pending,
      chipTone: saveState === 'error' || loadState === 'error' ? 'warning' : settingsReady ? 'growth' : 'muted',
      icon: Settings,
      rows: [
        [copy.price, `${formatNumber(pricePerKg)} ${locale === 'ko' ? '원/kg' : 'KRW/kg'}`],
        [copy.power, `${formatNumber(costPerKwh)} ${locale === 'ko' ? '원/kWh' : 'KRW/kWh'}`],
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
      body: locale === 'ko' ? '질문 도우미에 현재 작물, 가격 기준, 전력 단가를 함께 전달해 문의 내용을 정리합니다.' : 'Collect crop, price, and power-cost context before support follow-up.',
      chip: assistantOpen ? copy.open : copy.pending,
      chipTone: assistantOpen ? 'growth' : 'muted',
      icon: LifeBuoy,
      rows: [
        [copy.assistant, assistantOpen ? copy.open : copy.pending],
        [copy.crop, selectedCropLabel],
      ],
      actionLabel: copy.open,
      onAction: onOpenAssistant,
    },
  ];

  const fallbackDetailTabs = locale === 'ko'
    ? [
        { id: 'contact-settings', label: '운영 기준' },
        { id: 'contact-connections', label: '연결 상태' },
        { id: 'contact-support', label: '문의 준비' },
      ]
    : [
        { id: 'contact-settings', label: 'Settings' },
        { id: 'contact-connections', label: 'Connections' },
        { id: 'contact-support', label: 'Support' },
      ];
  const detailTabs = tabs.length > 0 ? tabs : fallbackDetailTabs;
  const activePanel = isContactPanelId(activeTabId) ? activeTabId : localActivePanel;
  const handlePanelSelect = (id: string) => {
    if (!isContactPanelId(id)) {
      return;
    }
    if (onSelectTab) {
      onSelectTab(id);
      return;
    }
    setLocalActivePanel(id);
  };

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
          { label: copy.price, value: formatNumber(pricePerKg), detail: locale === 'ko' ? '원/kg' : 'KRW/kg' },
          { label: copy.power, value: formatNumber(costPerKwh), detail: locale === 'ko' ? '원/kWh' : 'KRW/kWh' },
        ],
        chartLabel: locale === 'ko' ? '연동 준비도' : 'Connection readiness',
        chartStatus: weatherConnected && marketConnected ? copy.connected : copy.issue,
        chartValues: [
          telemetrySummary.toLowerCase().includes('offline') ? 0 : 1,
          weatherConnected ? 1 : 0,
          marketConnected ? 1 : 0,
          settingsReady ? 1 : 0,
          assistantOpen ? 1 : 0,
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
        badgeCaption: locale === 'ko' ? '현황' : 'LIVE',
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
        badgeCaption: locale === 'ko' ? '저장' : 'SETTINGS',
        badgeLabel: settingsReady ? copy.connected : copy.pending,
        rows: [
          [copy.crop, selectedCropLabel],
          [copy.price, `${formatNumber(pricePerKg)} ${locale === 'ko' ? '원/kg' : 'KRW/kg'}`],
          [copy.power, `${formatNumber(costPerKwh)} ${locale === 'ko' ? '원/kWh' : 'KRW/kWh'}`],
          [locale === 'ko' ? '작물 기준' : 'Crop key', selectedCropLabel],
        ],
      }}
      bridgeEyebrow={copy.bridgeEyebrow}
      bridgeTitle={copy.bridgeTitle}
      bridgeCards={bridgeCards}
      detailEyebrow={copy.detailEyebrow}
      detailTitle={copy.detailTitle}
      detailDescription={copy.detailDescription}
      sectionTabs={detailTabs}
      activeSectionId={activePanel}
      onSelectSection={handlePanelSelect}
      onOpenAssistant={onOpenAssistant}
    >
      <div id="contact-settings" className="scroll-mt-24 space-y-4">
        {activePanel === 'contact-settings' ? (
          <section id="contact-settings-panel" className="min-w-0" aria-label={detailTabs[0].label}>
            {shellCard}
          </section>
        ) : null}
        {activePanel === 'contact-connections' ? (
          <section id="contact-connections" className="min-w-0" aria-label={detailTabs[1].label}>
            {laneCard}
          </section>
        ) : null}
        {activePanel === 'contact-support' ? (
          <section id="contact-support" className="min-w-0" aria-label={detailTabs[2].label}>
            {supportCard}
          </section>
        ) : null}
      </div>
    </FeatureLandingFrame>
  );
}
