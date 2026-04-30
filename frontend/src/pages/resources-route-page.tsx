import { Suspense, lazy } from 'react';
import { CloudSun, Droplets, Leaf, TrendingUp, WalletCards, Zap } from 'lucide-react';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
} from '../components/dashboard/FeatureLandingFrame';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { AppLocale } from '../i18n/locale';
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

const ResourcesCommandCenter = lazy(() => import('../components/resources/ResourcesCommandCenter'));

interface ResourcesRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  cropLabel: string;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  history?: SensorData[];
  forecast?: ForecastData | null;
  summary?: SmartGrowKnowledgeSummary | null;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  rtrProfile?: RtrProfile | null;
  produceLoading: boolean;
  produceError: string | null;
  activePanel?: 'resources-nutrient' | 'resources-energy' | 'resources-market';
  initialCorrectionToolOpen?: boolean;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
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

function formatKrw(value: number | null | undefined, locale: AppLocale): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return locale === 'ko'
    ? `${value.toLocaleString('ko-KR')}원`
    : `${value.toLocaleString('en-US')} KRW`;
}

export default function ResourcesRoutePage({
  locale,
  crop,
  cropLabel,
  currentData,
  modelMetrics,
  history = [],
  forecast = null,
  summary = null,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  rtrProfile = null,
  produceLoading,
  produceError,
  activePanel = 'resources-energy',
  initialCorrectionToolOpen = false,
  tabs = [],
  activeTabId,
  onSelectTab,
  onOpenAssistant,
}: ResourcesRoutePageProps) {
  const activeSurfaceId = activeTabId ?? activePanel;
  const selectedMarket = selectProduceItemForCrop(producePrices, crop, { marketPreference: ['wholesale', 'retail'] });
  const marketItem = selectedMarket?.item ?? null;
  const selectedPriceTrend = marketItem
    ? producePrices?.trend?.series.find((series) => series.key === marketItem.key || series.display_name === marketItem.display_name)
    : null;
  const marketPriceSeries = appendFiniteValue(
    mapNumericSeries(selectedPriceTrend?.points, (point) => point.actual_price_krw, 24),
    marketItem?.current_price_krw,
    24,
  );
  const energySeries = history.length
    ? history.slice(-8).map((point) => point.energyUsage || modelMetrics.energy.consumption)
    : [modelMetrics.energy.consumption, modelMetrics.energy.costPrediction, modelMetrics.energy.efficiency, forecast?.total_energy_kWh ?? 0];
  const copy = locale === 'ko'
    ? {
        title: '양액·에너지',
        description: '양액, 배액, 에너지, 외기, 시세를 한 화면 안에서 그래프로 확인합니다.',
        heroBadge: '양액·에너지 의사결정',
        heroTitle: '오이 양액과 에너지 비용을 같은 기준으로 봅니다',
        heroBody: '양액, 전력, 외기, 도매 시세를 세부 탭에서 각각 확인합니다.',
        primary: '양액 솔루션',
        secondary: '도매 시세',
        live: '자원 운영 요약',
        freshness: '날씨·시세·양액 연결 상태 반영',
        actionsEyebrow: '자원 판단 전 확인',
        actionsTitle: '비용과 양액 판단 전에 볼 4가지',
        comparisonEyebrow: '자원 균형',
        comparisonTitle: '현재 양액·에너지 기준과 추천 신호 비교',
        comparisonStatus: '연결됨',
        bridgeEyebrow: '양액 · 에너지 · 시세',
        bridgeTitle: '자원 판단 요약',
        detailEyebrow: '세부 기능',
        detailTitle: '양액·에너지·시세 상세 화면',
        detailDescription: '아래 탭에서 양액, 에너지, 시세 기능을 각각 확인합니다.',
        open: '열기',
      }
    : {
        title: 'Resources',
        description: 'Review nutrient, drainage, energy, outside weather, and market charts in one product frame.',
        heroBadge: 'Resource decision lane',
        heroTitle: 'Keep cucumber nutrient and energy cost in one operating view',
        heroBody: 'Weather charts, energy use, nutrient advice, and KAMIS market prices stay available without the old sidebar.',
        primary: 'Nutrient solution',
        secondary: 'Market chart',
        live: 'Resource Live Overview',
        freshness: 'weather · market · nutrient APIs connected',
        actionsEyebrow: 'Resource Action Board',
        actionsTitle: 'Four checks before resource decisions',
        comparisonEyebrow: 'Resource Balance',
        comparisonTitle: 'Current resource basis vs recommended signal',
        comparisonStatus: 'connected',
        bridgeEyebrow: 'Nutrient · Energy · Market',
        bridgeTitle: 'Resource summary',
        detailEyebrow: 'RESOURCES FULL SURFACES',
        detailTitle: 'Nutrient, energy, and market workspace',
        detailDescription: 'The detailed nutrient, energy, and market functions are preserved below inside the PNG-style product frame.',
        open: 'Open',
      };

  const metrics: FeatureMetric[] = [
    {
      label: locale === 'ko' ? '전력' : 'Energy',
      value: formatNumber(modelMetrics.energy.consumption, 1),
      unit: 'kW',
      detail: `COP ${formatNumber(modelMetrics.energy.efficiency, 2)}`,
      trendLabel: locale === 'ko' ? '사용량' : modelMetrics.energy.mode ?? 'load',
      icon: Zap,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'energyUsage', 24), modelMetrics.energy.consumption, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '전력 사용 흐름' : 'Energy-use trend',
    },
    {
      label: locale === 'ko' ? '비용' : 'Cost',
      value: formatNumber(modelMetrics.energy.costPrediction, 2),
      detail: locale === 'ko' ? '예상 시간당 비용' : 'estimated hourly cost',
      trendLabel: locale === 'ko' ? '비용' : 'cost',
      icon: WalletCards,
      tone: 'warning',
      series: forecast ? [modelMetrics.energy.costPrediction, forecast.total_energy_kWh].filter((value) => Number.isFinite(value)) : [],
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '비용 영향 흐름' : 'Cost signal trend',
    },
    {
      label: locale === 'ko' ? '배액' : 'Drain',
      value: formatNumber(currentData.soilMoisture, 1),
      unit: '%',
      detail: locale === 'ko' ? '근권 수분 신호' : 'root-zone signal',
      trendLabel: locale === 'ko' ? '양액' : 'nutrient',
      icon: Droplets,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'soilMoisture', 24), currentData.soilMoisture, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '근권 수분 흐름' : 'Root-zone moisture trend',
    },
    {
      label: locale === 'ko' ? '증발산' : 'ETc',
      value: formatNumber(forecast?.total_ETc_mm, 1),
      unit: 'mm',
      detail: locale === 'ko' ? '예측 증발산' : 'forecast evapotranspiration',
      trendLabel: locale === 'ko' ? '예측' : 'forecast',
      icon: Leaf,
      tone: 'normal',
      series: mapNumericSeries(forecast?.daily, (day) => day.ETc_mm, 14),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '증발산 예측 흐름' : 'ETc forecast trend',
    },
    {
      label: locale === 'ko' ? '외기' : 'Outside',
      value: weather ? formatNumber(weather.current.temperature_c, 1) : '-',
      unit: weather ? '°C' : undefined,
      detail: weather ? `${formatNumber(weather.current.relative_humidity_pct, 0)}% RH` : (weatherError ?? (locale === 'ko' ? '대기' : 'pending')),
      trendLabel: weather ? weather.current.weather_label : (locale === 'ko' ? '날씨' : 'weather'),
      icon: CloudSun,
      tone: weatherError ? 'warning' : 'normal',
      series: appendFiniteValue(mapNumericSeries(weather?.daily, (day) => day.temperature_max_c, 10), weather?.current.temperature_c, 10),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '외기 온도 흐름' : 'Outside temperature trend',
    },
    {
      label: locale === 'ko' ? '시세' : 'Market',
      value: marketItem ? formatKrw(marketItem.current_price_krw, locale).replace(' KRW', '') : '-',
      detail: marketItem?.unit ?? (produceError ?? (locale === 'ko' ? '대기' : 'pending')),
      trendLabel: marketItem ? `${marketItem.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(marketItem.day_over_day_pct, 1)}%` : (locale === 'ko' ? '도매 시세' : 'KAMIS'),
      icon: TrendingUp,
      tone: produceError ? 'warning' : 'normal',
      series: marketPriceSeries,
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '시세 흐름' : 'Market trend',
    },
  ];

  const actions: FeatureActionCard[] = [
    {
      title: locale === 'ko' ? '양액 교정안' : 'Nutrient correction',
      body: locale === 'ko' ? '양액·배액 상태와 작물 맥락을 기반으로 보정 초안을 확인합니다.' : 'Open nutrient correction with drainage and crop context preserved.',
      chip: locale === 'ko' ? '양액 보정' : '/api/nutrients/correction',
      icon: Droplets,
      tone: 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('resources-nutrient'),
    },
    {
      title: locale === 'ko' ? '전력 비용' : 'Energy cost',
      body: locale === 'ko' ? '전력수요, COP, 외기 조건을 같이 보며 냉난방 부담을 판단합니다.' : 'Read load, COP, and outside condition together.',
      chip: locale === 'ko' ? '전력 그래프' : '/api/overview/signals',
      icon: Zap,
      tone: modelMetrics.energy.consumption > 12 ? 'warning' : 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('resources-energy'),
    },
    {
      title: locale === 'ko' ? '시세 추세' : 'Market trend',
      body: locale === 'ko' ? '오이 도매 시세와 전일 대비 흐름을 그래프로 확인합니다.' : 'Open cucumber price series and day-over-day movement.',
      chip: locale === 'ko' ? '도매 시세' : '/api/market/produce',
      icon: WalletCards,
      tone: produceError ? 'warning' : 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('resources-market'),
    },
    {
      title: locale === 'ko' ? '외기 영향' : 'Outside impact',
      body: locale === 'ko' ? '대구 외기와 일사 흐름을 양액·냉난방 판단과 연결합니다.' : 'Tie Daegu weather and radiation to nutrient and HVAC decisions.',
      chip: locale === 'ko' ? '외기 영향' : '/api/weather/daegu',
      icon: CloudSun,
      tone: weatherError ? 'warning' : 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('resources-energy'),
    },
  ];

  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: locale === 'ko' ? '양액' : 'Nutrients',
      value: locale === 'ko' ? (summary?.nutrientCorrectionReady ? '준비됨' : '검토') : (summary?.nutrientCorrectionReady ? 'Ready' : 'Review'),
      body: locale === 'ko' ? '양액 추천과 교정 도구를 같은 탭에서 엽니다.' : 'Open recommendation and correction in the same tab.',
      chip: locale === 'ko' ? '양액 상담' : 'advisor/tab',
      chipTone: summary?.nutrientCorrectionReady ? 'growth' : 'stable',
      icon: Droplets,
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('resources-nutrient'),
    },
    {
      title: locale === 'ko' ? '에너지' : 'Energy',
      value: `${formatNumber(modelMetrics.energy.consumption, 1)} kW`,
      body: locale === 'ko' ? '외기와 전력수요 그래프를 함께 봅니다.' : 'Review outside weather and power demand together.',
      chip: locale === 'ko' ? '날씨' : 'weather',
      chipTone: weatherError ? 'warning' : 'growth',
      icon: Zap,
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('resources-energy'),
    },
    {
      title: locale === 'ko' ? '시세' : 'Market',
      value: marketItem ? formatKrw(marketItem.current_price_krw, locale).replace(' KRW', '') : '-',
      body: locale === 'ko' ? '도매 시세 흐름을 출하 판단과 연결합니다.' : 'Connect price movement to harvest pacing.',
      chip: locale === 'ko' ? '도매 시세' : 'KAMIS',
      chipTone: produceError ? 'warning' : 'growth',
      icon: WalletCards,
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('resources-market'),
    },
  ];

  return (
    <FeatureLandingFrame
      title={copy.title}
      description={copy.description}
      heroBadge={copy.heroBadge}
      heroTitle={copy.heroTitle}
      heroBody={copy.heroBody}
      primaryAction={{ label: copy.primary, onClick: () => onSelectTab?.('resources-nutrient') }}
      secondaryAction={{ label: copy.secondary, onClick: () => onSelectTab?.('resources-market'), variant: 'secondary' }}
      preview={{
        eyebrow: locale === 'ko' ? '자원 현황' : 'RESOURCE LIVE',
        title: locale === 'ko' ? '양액 · 에너지 · 시세' : 'Nutrient / Energy / Market',
        statusLabel: locale === 'ko' ? (weatherError || produceError ? '확인 필요' : '연결됨') : weatherError || produceError ? 'review' : 'connected',
        statusTone: weatherError || produceError ? 'warning' : 'growth',
        metrics: [
          { label: locale === 'ko' ? '전력' : 'Energy', value: `${formatNumber(modelMetrics.energy.consumption, 1)} kW`, detail: `COP ${formatNumber(modelMetrics.energy.efficiency, 2)}` },
          { label: locale === 'ko' ? '배액' : 'Drain', value: `${formatNumber(currentData.soilMoisture, 1)}%`, detail: locale === 'ko' ? '근권' : 'root zone' },
          { label: locale === 'ko' ? '시세' : 'Market', value: marketItem ? formatKrw(marketItem.current_price_krw, locale).replace(' KRW', '') : '-', detail: marketItem?.unit },
        ],
        chartLabel: locale === 'ko' ? '최근 에너지 사용 흐름' : 'Recent energy use',
        chartStatus: locale === 'ko' ? '그래프 기준' : 'chart basis',
        chartValues: energySeries,
      }}
      metricsEyebrow={copy.live}
      metricsFreshness={copy.freshness}
      metrics={metrics}
      actionsEyebrow={copy.actionsEyebrow}
      actionsTitle={copy.actionsTitle}
      actions={actions}
      comparisonEyebrow={copy.comparisonEyebrow}
      comparisonTitle={copy.comparisonTitle}
      comparisonStatusLabel={copy.comparisonStatus}
      comparisonStatusTone={weatherError || produceError ? 'warning' : 'growth'}
      comparisonNote={cropLabel}
      baseline={{
        title: locale === 'ko' ? '현재 자원 기준' : 'Current resource basis',
        subtitle: locale === 'ko' ? '센서와 예측값' : 'Sensors and forecast',
        badgeCaption: locale === 'ko' ? '현재' : 'LIVE',
        badgeLabel: `${formatNumber(modelMetrics.energy.consumption, 1)} kW`,
        rows: [
          [locale === 'ko' ? '배액' : 'Drain', `${formatNumber(currentData.soilMoisture, 1)}%`],
          [locale === 'ko' ? '증발산' : 'ETc', `${formatNumber(forecast?.total_ETc_mm, 1)} mm`],
          [locale === 'ko' ? '전력' : 'Energy', `${formatNumber(forecast?.total_energy_kWh, 1)} kWh`],
          [locale === 'ko' ? '비용' : 'Cost', formatNumber(modelMetrics.energy.costPrediction, 2)],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '추천 검토 기준' : 'Recommended review basis',
        subtitle: locale === 'ko' ? '양액·외기·시세 연결' : 'Nutrient, weather, and market linked',
        badgeCaption: locale === 'ko' ? '검토' : 'REVIEW',
        badgeLabel: locale === 'ko' ? '양액·시세' : 'Nutrient / market',
        rows: [
          [locale === 'ko' ? '날씨' : 'Weather', weather ? `${formatNumber(weather.current.temperature_c, 1)}°C` : '-'],
          [locale === 'ko' ? '시세' : 'Market', marketItem ? formatKrw(marketItem.current_price_krw, locale) : '-'],
          [locale === 'ko' ? '권장온도' : 'RTR', rtrProfile ? `${formatNumber(rtrProfile.baseTempC, 1)}°C` : '-'],
          [locale === 'ko' ? '수확' : 'Yield', `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg`],
        ],
      }}
      bridgeEyebrow={copy.bridgeEyebrow}
      bridgeTitle={copy.bridgeTitle}
      bridgeCards={bridgeCards}
      detailEyebrow={copy.detailEyebrow}
      detailTitle={copy.detailTitle}
      detailDescription={copy.detailDescription}
      sectionTabs={tabs}
      activeSectionId={activeSurfaceId}
      onSelectSection={onSelectTab}
      onOpenAssistant={onOpenAssistant}
    >
      <section id="resources-surfaces" className="scroll-mt-24 space-y-4" aria-label={copy.detailTitle}>
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '자원과 비용' : 'Resources and cost'}
              loadingMessage={locale === 'ko' ? '자원 운영 화면을 불러오는 중입니다...' : 'Loading resource cockpit...'}
              minHeightClassName="min-h-[520px]"
            />
          )}
        >
          <ResourcesCommandCenter
            locale={locale}
            crop={crop}
            cropLabel={cropLabel}
            currentData={currentData}
            modelMetrics={modelMetrics}
            history={history}
            forecast={forecast}
            summary={summary}
            weather={weather}
            weatherLoading={weatherLoading}
            weatherError={weatherError}
            producePrices={producePrices}
            rtrProfile={rtrProfile}
            produceLoading={produceLoading}
            produceError={produceError}
            activePanel={activePanel}
            initialCorrectionToolOpen={initialCorrectionToolOpen}
          />
        </Suspense>
      </section>
    </FeatureLandingFrame>
  );
}
