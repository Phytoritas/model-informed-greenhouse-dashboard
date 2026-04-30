import { Suspense, lazy, useEffect } from 'react';
import { Activity, Calculator, CircleGauge, CloudSun, Droplets, Leaf, LineChart, ThermometerSun } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import ModelScenarioWorkbench from '../components/dashboard/ModelScenarioWorkbench';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
} from '../components/dashboard/FeatureLandingFrame';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { RTROptimizerStateLike, RTROptimizerUiStateLike } from '../components/RTROptimizerPanel';
import type {
  AdvancedModelMetrics,
  CropType,
  ProducePricesPayload,
  RtrOptimizationMode,
  RtrProfile,
  SensorData,
  TelemetryStatus,
  TemperatureSettings,
  WeatherOutlook,
} from '../types';
import { getCropLabel } from '../utils/displayCopy';
import { selectProduceItemForCrop } from '../utils/producePriceSelectors';
import { appendFiniteValue, mapNumericSeries, pickNumericSeries } from '../utils/metricTrendSeries';

const RTROptimizerPanel = lazy(() => import('../components/RTROptimizerPanel'));

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function telemetryLabel(status: TelemetryStatus | undefined, locale: 'ko' | 'en'): string {
  if (!status) {
    return locale === 'ko' ? '실시간' : 'live';
  }
  if (locale !== 'ko') {
    return status;
  }
  return ({
    live: '실시간',
    delayed: '지연',
    stale: '오래됨',
    offline: '오프라인',
    loading: '연결 중',
  } as const)[status] ?? status;
}

interface ScenariosRoutePageProps {
  locale: 'ko' | 'en';
  crop: CropType;
  currentData: SensorData;
  history: SensorData[];
  modelMetrics: AdvancedModelMetrics;
  telemetryStatus?: TelemetryStatus;
  temperatureSettings: TemperatureSettings;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
  produceError: string | null;
  knowledgeSummary: SmartGrowKnowledgeSummary | null;
  knowledgeLoading: boolean;
  knowledgeError: string | null;
  profile: RtrProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  optimizerEnabled?: boolean;
  defaultMode?: RtrOptimizationMode;
  onRefreshProfiles?: () => void | Promise<void>;
  optimizerState?: RTROptimizerStateLike;
  uiState?: RTROptimizerUiStateLike;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
  onOpenAssistant: () => void;
}

export default function ScenariosRoutePage({
  locale,
  crop,
  currentData,
  history,
  modelMetrics,
  telemetryStatus,
  temperatureSettings,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  produceLoading,
  produceError,
  profile,
  profileLoading,
  profileError,
  optimizerEnabled,
  defaultMode,
  onRefreshProfiles,
  optimizerState,
  uiState,
  tabs = [],
  activeTabId,
  onSelectTab,
  onOpenAssistant,
}: ScenariosRoutePageProps) {
  const location = useLocation();
  const copy = locale === 'ko'
    ? {
        eyebrow: '조정 검토',
        title: '온실 조정 검토',
        description: '온도, CO2, 습도, 스크린 조정을 실제 계산으로 비교하고 수량·에너지 변화를 확인합니다.',
        rtrLoading: '온도 기준 검토를 불러오는 중입니다...',
        heroTitle: '과정기반 계산과 권장 온도 민감도를 함께 검토',
        heroBody: '개요 화면에는 요약만 두고, 여기에서 온도·CO2·습도 조정이 수량과 에너지에 주는 영향을 자세히 계산합니다.',
        model: '수량 영향 계산',
        modelBody: '온도·CO2·상대습도 변경이 수확 전망에 미치는 영향을 계산합니다.',
        rtr: '온도 민감도',
        rtrBody: '기준안과 개선안을 비교하고 작은 조정이 만드는 효과를 확인합니다.',
        telemetry: '현재 환경',
        optimizerOn: '계산 가능',
        optimizerOff: '기준 확인 중',
        profileReady: '권장 기준 연결',
        profilePending: '권장 기준 확인 중',
        profileError: '권장 기준 확인 필요',
      }
    : {
        eyebrow: 'Scenarios',
        title: 'Greenhouse what-if review',
        description: 'Compare temperature, CO2, humidity, and screen adjustments through model-backed yield and energy calculations.',
        rtrLoading: 'Loading RTR scenario surface...',
        heroTitle: 'Keep process-model and RTR sensitivity on the same review line',
        heroBody: 'Scenario adjustments call the model runtime API while RTR sensitivity uses the optimizer API. The full backend-backed surfaces stay here.',
        model: 'Model adjustment',
        modelBody: 'Calculate temperature, CO2, and RH what-if changes.',
        rtr: 'RTR sensitivity',
        rtrBody: 'Compare baseline and optimized strategy through marginal effects.',
        telemetry: 'Current climate',
        optimizerOn: 'Optimizer active',
        optimizerOff: 'Profile pending',
        profileReady: 'Profile connected',
        profilePending: 'Checking profile',
        profileError: 'Check profile',
      };

  useEffect(() => {
    const targetId = location.hash.replace(/^#/, '');
    if (!targetId) {
      return;
    }

    const scheduleFrame = window.requestAnimationFrame
      ?? ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;
    const frame = scheduleFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    });

    return () => cancelFrame(frame);
  }, [location.hash]);

  const cropLabel = getCropLabel(crop, locale);
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
  const marketPending = produceLoading && !selectedMarket?.item;
  const profileStatusLabel = profileError
    ? copy.profileError
    : profileLoading
      ? copy.profilePending
      : copy.profileReady;
  const profileStatusTone = profileError ? 'warning' : profileLoading ? 'muted' : 'growth';
  const activeScenarioPanel = activeTabId === 'scenario-rtr' ? 'scenario-rtr' : 'scenario-model';
  const selectScenarioPanel = (panelId: 'scenario-model' | 'scenario-rtr') => {
    if (onSelectTab) {
      onSelectTab(panelId);
      return;
    }
    const target = document.getElementById(panelId);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  const metrics: FeatureMetric[] = [
    {
      label: locale === 'ko' ? '온도' : 'Temp',
      value: formatNumber(currentData.temperature, 1),
      unit: '°C',
      detail: `${copy.telemetry} · ${telemetryLabel(telemetryStatus, locale)}`,
      trendLabel: telemetryStatus === 'offline' ? (locale === 'ko' ? '오프라인' : 'Offline') : (locale === 'ko' ? '센서 기준' : 'sensor'),
      icon: ThermometerSun,
      tone: telemetryStatus === 'offline' ? 'critical' : telemetryStatus === 'delayed' || telemetryStatus === 'stale' ? 'warning' : 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'temperature', 24), currentData.temperature, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '온도 조정 기준 흐름' : 'Temperature scenario trend',
    },
    {
      label: 'CO2',
      value: formatNumber(currentData.co2, 0),
      unit: 'ppm',
      detail: locale === 'ko' ? `목표 ${temperatureSettings.co2Target ?? '-'} ppm` : `${temperatureSettings.co2Target ?? '-'} ppm target`,
      trendLabel: locale === 'ko' ? '조정 입력' : 'what-if input',
      icon: Leaf,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'co2', 24), currentData.co2, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '이산화탄소 조정 흐름' : 'CO2 scenario trend',
    },
    {
      label: locale === 'ko' ? '습도' : 'RH',
      value: formatNumber(currentData.humidity, 0),
      unit: '%',
      detail: `VPD ${formatNumber(currentData.vpd, 2)} kPa`,
      trendLabel: currentData.vpd < 0.75 ? (locale === 'ko' ? '습도 주의' : 'Humidity watch') : (locale === 'ko' ? '안정' : 'stable'),
      icon: Droplets,
      tone: currentData.vpd < 0.75 ? 'warning' : 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'humidity', 24), currentData.humidity, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '습도 흐름' : 'Humidity trend',
    },
    {
      label: locale === 'ko' ? '예상 수확' : 'Yield outlook',
      value: formatNumber(modelMetrics.yield.predictedWeekly, 1),
      unit: locale === 'ko' ? 'kg/주' : 'kg/wk',
      detail: locale === 'ko' ? `신뢰도 ${Math.round(modelMetrics.yield.confidence * 100)}%` : `${Math.round(modelMetrics.yield.confidence * 100)}% confidence`,
      trendLabel: copy.model,
      icon: LineChart,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'photosynthesis', 24), currentData.photosynthesis, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '수량 영향 입력 흐름' : 'Yield input trend',
    },
    {
      label: locale === 'ko' ? '권장온도' : 'RTR',
      value: profile ? formatNumber(profile.baseTempC, 1) : '-',
      unit: profile ? (locale === 'ko' ? '°C 기준' : '°C base') : undefined,
      detail: locale === 'ko' ? profileStatusLabel : profile?.strategyLabel ?? profileStatusLabel,
      trendLabel: profileStatusLabel,
      icon: CircleGauge,
      tone: profileStatusTone === 'warning' ? 'warning' : profileStatusTone === 'muted' ? 'muted' : 'normal',
      series: profile ? appendFiniteValue(pickNumericSeries(history, 'temperature', 24), profile.baseTempC, 24) : [],
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '권장온도 기준 흐름' : 'RTR basis trend',
    },
    {
      label: locale === 'ko' ? '시장 맥락' : 'Market context',
      value: selectedMarket?.item ? formatNumber(selectedMarket.item.day_over_day_pct, 1) : '-',
      unit: selectedMarket?.item ? '%' : undefined,
      detail: selectedMarket?.item.display_name ?? cropLabel,
      trend: selectedMarket?.item.direction === 'down' ? 'down' : selectedMarket?.item.direction === 'up' ? 'up' : 'stable',
      trendLabel: produceError ? (locale === 'ko' ? '시세 확인' : 'Check market') : selectedMarket?.item ? (locale === 'ko' ? '도매 시세' : 'KAMIS') : marketPending ? (locale === 'ko' ? '불러오는 중' : 'loading') : (locale === 'ko' ? '대기' : 'pending'),
      icon: CloudSun,
      tone: produceError ? 'warning' : selectedMarket?.item ? 'normal' : 'muted',
      series: marketPriceSeries,
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '시세 흐름' : 'Market trend',
    },
    {
      label: locale === 'ko' ? '외기 위험' : 'Outside risk',
      value: weather ? formatNumber(weather.current.precipitation_mm, 1) : '-',
      unit: weather ? 'mm' : undefined,
      detail: weather?.current.weather_label ?? weatherError ?? (locale === 'ko' ? '날씨 대기' : 'weather pending'),
      trendLabel: weatherError ? (locale === 'ko' ? '확인 필요' : 'Check') : (locale === 'ko' ? '날씨' : 'weather'),
      icon: CloudSun,
      tone: weatherError ? 'warning' : 'normal',
      series: appendFiniteValue(mapNumericSeries(weather?.daily, (day) => day.precipitation_probability_max_pct, 10), weather?.current.precipitation_mm, 10),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '외기 위험 흐름' : 'Outside risk trend',
    },
  ];

  const actionCards: FeatureActionCard[] = [
    {
      title: copy.model,
      body: copy.modelBody,
      chip: locale === 'ko' ? '수량 계산' : '/api/models/scenario',
      icon: Calculator,
      tone: 'normal',
      actionLabel: locale === 'ko' ? '계산' : 'Run',
      onAction: () => selectScenarioPanel('scenario-model'),
    },
    {
      title: copy.rtr,
      body: copy.rtrBody,
      chip: locale === 'ko' ? '민감도 계산' : '/api/rtr/sensitivity',
      icon: CircleGauge,
      tone: optimizerEnabled ? 'normal' : 'warning',
      actionLabel: locale === 'ko' ? '비교' : 'Compare',
      onAction: () => selectScenarioPanel('scenario-rtr'),
    },
    {
      title: locale === 'ko' ? '현재 환경 범위' : 'Current climate range',
      body: locale === 'ko'
        ? `온도 ${formatNumber(currentData.temperature, 1)}°C · CO2 ${formatNumber(currentData.co2, 0)} ppm · 습도 ${formatNumber(currentData.humidity, 0)}% · 증산지표 ${formatNumber(currentData.vpd, 2)} kPa`
        : `Temp ${formatNumber(currentData.temperature, 1)}°C · CO2 ${formatNumber(currentData.co2, 0)} ppm · RH ${formatNumber(currentData.humidity, 0)}% · VPD ${formatNumber(currentData.vpd, 2)} kPa`,
      chip: telemetryStatus === 'offline' ? (locale === 'ko' ? '연결 확인' : 'Check link') : (locale === 'ko' ? '센서 기준' : 'Sensor basis'),
      icon: Activity,
      tone: telemetryStatus === 'offline' ? 'critical' : 'normal',
      actionLabel: locale === 'ko' ? '상세' : 'Details',
      onAction: () => selectScenarioPanel('scenario-model'),
    },
    {
      title: locale === 'ko' ? '날씨·시세 맥락' : 'Weather-market context',
      body: weather?.summary ?? weatherError ?? (selectedMarket?.item ? `${selectedMarket.item.display_name} ${formatNumber(selectedMarket.item.day_over_day_pct, 1)}%` : 'Context feeds stay linked for scenario review.'),
      chip: weatherError || produceError ? (locale === 'ko' ? '확인 필요' : 'Check') : (locale === 'ko' ? '연동됨' : 'Connected'),
      icon: CloudSun,
      tone: weatherError || produceError ? 'warning' : 'normal',
      actionLabel: locale === 'ko' ? '날씨·시세' : 'Insights',
      to: '/trend',
    },
  ];

  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: copy.model,
      value: locale === 'ko' ? '수량 계산' : '/api/models/scenario',
      body: locale === 'ko' ? '온도·CO2·상대습도 입력 범위를 바꿔 수확 전망 변화를 계산합니다.' : 'Run process-model what-if calculations across temperature, CO2, and RH ranges.',
      chip: locale === 'ko' ? '실제 계산' : 'Model-backed',
      chipTone: 'growth',
      icon: Calculator,
      rows: [
        [locale === 'ko' ? '온도' : 'Temp', `${formatNumber(currentData.temperature, 1)}°C`],
        ['CO2', `${formatNumber(currentData.co2, 0)} ppm`],
      ],
      actionLabel: locale === 'ko' ? '실행' : 'Run',
      onAction: () => selectScenarioPanel('scenario-model'),
    },
    {
      title: copy.rtr,
      value: optimizerEnabled ? copy.optimizerOn : copy.optimizerOff,
      body: locale === 'ko' ? profileStatusLabel : profile?.sourceNote ?? profileStatusLabel,
      chip: profileStatusLabel,
      chipTone: profileStatusTone,
      icon: CircleGauge,
      rows: [
        [locale === 'ko' ? '기준온도' : 'Base temp', profile ? `${formatNumber(profile.baseTempC, 1)}°C` : '-'],
        [locale === 'ko' ? '허용편차' : 'Tolerance', profile ? `±${formatNumber(profile.toleranceC, 1)}°C` : '-'],
      ],
      actionLabel: locale === 'ko' ? '비교' : 'Compare',
      onAction: () => selectScenarioPanel('scenario-rtr'),
    },
    {
      title: locale === 'ko' ? '날씨·시세 해석' : 'Weather-market reading',
      value: selectedMarket?.item?.display_name ?? cropLabel,
      body: weather?.summary ?? weatherError ?? (selectedMarket?.item
        ? `${selectedMarket.item.display_name} ${formatNumber(selectedMarket.item.day_over_day_pct, 1)}%`
        : locale === 'ko' ? '시나리오 결과를 외기와 오이 시세 흐름과 함께 해석합니다.' : 'Read scenario output with weather and cucumber price context.'),
      chip: weatherError || produceError ? (locale === 'ko' ? '확인 필요' : 'Check') : (locale === 'ko' ? '해석 기준' : 'Context'),
      chipTone: weatherError || produceError ? 'warning' : 'growth',
      icon: CloudSun,
      rows: [
        [locale === 'ko' ? '외기' : 'Weather', weather ? weather.current.weather_label : '-'],
        [locale === 'ko' ? '도매 시세' : 'KAMIS', selectedMarket?.item?.display_name ?? '-'],
      ],
      actionLabel: locale === 'ko' ? '인사이트' : 'Insights',
      to: '/trend',
    },
  ];

  return (
    <FeatureLandingFrame
      title={copy.title}
      description={copy.description}
      heroBadge={locale === 'ko' ? '가정 조정 · 온도 민감도 · 오이' : 'What-if · RTR · Cucumber model'}
      heroTitle={copy.heroTitle}
      heroBody={copy.heroBody}
      primaryAction={{ label: locale === 'ko' ? '수량 영향 계산' : 'Model Scenario', onClick: () => selectScenarioPanel('scenario-model') }}
      secondaryAction={{ label: locale === 'ko' ? '온도 기준 비교' : 'RTR Compare', onClick: () => selectScenarioPanel('scenario-rtr') }}
      preview={{
        eyebrow: locale === 'ko' ? '계산 현황' : 'SCENARIO LIVE',
        title: locale === 'ko' ? '수량 영향 / 온도 민감도' : 'Process model / RTR sensitivity',
        statusLabel: optimizerEnabled ? copy.optimizerOn : copy.optimizerOff,
        statusTone: optimizerEnabled ? 'growth' : 'warning',
        metrics: [
          { label: locale === 'ko' ? '온도' : 'Temp', value: `${formatNumber(currentData.temperature, 1)}°C`, detail: locale === 'ko' ? '센서' : 'sensor' },
          { label: 'CO2', value: `${formatNumber(currentData.co2, 0)} ppm`, detail: locale === 'ko' ? '입력' : 'input' },
          { label: locale === 'ko' ? '수확' : 'Yield', value: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg`, detail: locale === 'ko' ? '예측' : 'model' },
        ],
        chartLabel: locale === 'ko' ? '조정 범위' : 'Adjustment range',
        chartStatus: profile ? `±${formatNumber(profile.toleranceC, 1)}°C` : profileStatusLabel,
        chartValues: history.slice(-7).map((point) => point.temperature),
      }}
      metricsEyebrow={locale === 'ko' ? '실시간 요약' : 'Live Overview'}
      metricsFreshness={locale === 'ko' ? `센서 ${telemetryLabel(telemetryStatus, locale)}` : (telemetryStatus ? `Telemetry ${telemetryStatus}` : copy.telemetry)}
      metrics={metrics}
      actionsEyebrow={locale === 'ko' ? '계산 항목' : 'Scenario Action Board'}
      actionsTitle={locale === 'ko' ? '실제 계산으로 확인할 4가지' : 'Four backend-backed calculations to run'}
      actions={actionCards}
      comparisonEyebrow={locale === 'ko' ? '시나리오 최적화' : 'Scenario Optimizer'}
      comparisonTitle={locale === 'ko' ? '현재 관측과 권장 온도 기준 비교' : 'Current observation vs RTR guardrail'}
      comparisonStatusLabel={optimizerEnabled ? copy.optimizerOn : copy.optimizerOff}
      comparisonStatusTone={optimizerEnabled ? 'growth' : 'warning'}
      comparisonNote={cropLabel}
      baseline={{
        title: locale === 'ko' ? '현재 관측' : 'Current observation',
        subtitle: locale === 'ko' ? '센서 기반 기준선' : 'Sensor-based baseline',
        badgeCaption: locale === 'ko' ? '모델' : 'MODEL',
        badgeLabel: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} ${locale === 'ko' ? 'kg/주' : 'kg/wk'}`,
        rows: [
          [locale === 'ko' ? '온도' : 'Temp', `${formatNumber(currentData.temperature, 1)}°C`],
          ['CO2', `${formatNumber(currentData.co2, 0)} ppm`],
          [locale === 'ko' ? '습도' : 'RH', `${formatNumber(currentData.humidity, 0)}%`],
          [locale === 'ko' ? '증산지표' : 'VPD', `${formatNumber(currentData.vpd, 2)} kPa`],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '권장 온도 기준' : 'RTR guardrail',
        subtitle: optimizerEnabled ? copy.optimizerOn : copy.optimizerOff,
        badgeCaption: locale === 'ko' ? '권장' : 'RTR',
        badgeLabel: locale === 'ko'
          ? (profile ? `${formatNumber(profile.baseTempC, 1)}°C 기준` : profileStatusLabel)
          : profile ? profile.strategyLabel : profileStatusLabel,
        rows: [
          [locale === 'ko' ? '기준온도' : 'Base temp', profile ? `${formatNumber(profile.baseTempC, 1)}°C` : '-'],
          [locale === 'ko' ? '기울기' : 'Slope', profile ? `${formatNumber(profile.slopeCPerMjM2, 2)}°C/MJ` : '-'],
          [locale === 'ko' ? '허용편차' : 'Tolerance', profile ? `±${formatNumber(profile.toleranceC, 1)}°C` : '-'],
          ['CO2', `${temperatureSettings.co2Target ?? '-'} ppm`],
        ],
      }}
      bridgeEyebrow={locale === 'ko' ? '계산 · 온도 기준 · 외부 맥락' : 'Model · RTR · Context Bridge'}
      bridgeTitle={locale === 'ko' ? '실제 계산 화면으로 이동' : 'Move to the actual calculation surfaces'}
      bridgeCards={bridgeCards}
      detailEyebrow={locale === 'ko' ? '세부 기능' : 'SCENARIO FULL SURFACES'}
      detailTitle={locale === 'ko' ? '가정 조정과 온도 민감도' : 'Full What-if and RTR workspace'}
      detailDescription={locale === 'ko' ? '아래 영역에서 수량 영향 계산과 온도 기준 비교를 세부적으로 확인합니다.' : 'The panels below preserve the existing model runtime and RTR optimizer integrations.'}
      sectionTabs={tabs}
      activeSectionId={activeScenarioPanel}
      onSelectSection={(id) => {
        if (id === 'scenario-model' || id === 'scenario-rtr') {
          selectScenarioPanel(id);
        }
      }}
      onOpenAssistant={onOpenAssistant}
    >
      {activeScenarioPanel === 'scenario-model' ? (
        <section id="scenario-model" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
          <ModelScenarioWorkbench crop={crop} />
        </section>
      ) : null}
      {activeScenarioPanel === 'scenario-rtr' ? (
        <section id="scenario-rtr" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
          <Suspense
            fallback={(
              <LoadingSkeleton
                title={locale === 'ko' ? '온도 민감도' : 'RTR Scenario'}
                loadingMessage={copy.rtrLoading}
                minHeightClassName="min-h-[420px]"
              />
            )}
          >
            <RTROptimizerPanel
              key={`scenarios-${crop}`}
              crop={crop}
              currentData={currentData}
              history={history}
              telemetryStatus={telemetryStatus}
              temperatureSettings={temperatureSettings}
              weather={weather}
              loading={weatherLoading}
              error={weatherError}
              profile={profile}
              profileLoading={profileLoading}
              profileError={profileError}
              optimizerEnabled={optimizerEnabled}
              defaultMode={defaultMode}
              onRefreshProfiles={onRefreshProfiles}
              optimizerState={optimizerState}
              uiState={uiState}
            />
          </Suspense>
        </section>
      ) : null}
    </FeatureLandingFrame>
  );
}
