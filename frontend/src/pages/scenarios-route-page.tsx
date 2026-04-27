import { Suspense, lazy, useEffect } from 'react';
import { Activity, Calculator, CircleGauge, CloudSun, Droplets, FlaskConical, Leaf, LineChart, ThermometerSun } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import PageSectionTabs from '../components/phyto/PageSectionTabs';
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
  knowledgeSummary,
  knowledgeLoading,
  knowledgeError,
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
        eyebrow: 'Scenarios',
        title: '온실 What-if 검토',
        description: '온도, CO2, 습도, 스크린 조정을 실제 모델 계산으로 비교하고 수량·에너지 변화를 확인합니다.',
        rtrLoading: 'RTR 시나리오 표면을 불러오는 중입니다...',
        heroTitle: '과정기반모델과 RTR 민감도를 같은 검토선에 배치',
        heroBody: '조정안 계산은 모델 런타임 API로, RTR 민감도는 최적화 API로 실행합니다. 개요 화면에는 요약만 두고 여기에서 전체 계산을 확인합니다.',
        model: '모델 조정안',
        modelBody: '온도·CO2·상대습도 변경을 What-if로 계산합니다.',
        rtr: 'RTR 민감도',
        rtrBody: '기준안과 최적안을 비교하고 편미분 기반 효과를 확인합니다.',
        telemetry: '현재 환경',
        optimizerOn: '최적화 활성',
        optimizerOff: '프로필 대기',
        profileReady: '프로필 연결',
        profilePending: '프로필 확인 중',
        profileError: '프로필 확인 필요',
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
  const marketPending = produceLoading && !selectedMarket?.item;
  const readySurfaceCount = knowledgeSummary?.surfaces.filter((surface) => surface.status === 'ready').length ?? 0;
  const profileStatusLabel = profileError
    ? copy.profileError
    : profileLoading
      ? copy.profilePending
      : copy.profileReady;
  const profileStatusTone = profileError ? 'warning' : profileLoading ? 'muted' : 'growth';

  const metrics: FeatureMetric[] = [
    {
      label: 'Temp',
      value: formatNumber(currentData.temperature, 1),
      unit: '°C',
      detail: `${copy.telemetry} · ${telemetryStatus ?? 'live'}`,
      trendLabel: telemetryStatus === 'offline' ? (locale === 'ko' ? '오프라인' : 'Offline') : 'sensor',
      icon: ThermometerSun,
      tone: telemetryStatus === 'offline' ? 'critical' : telemetryStatus === 'delayed' || telemetryStatus === 'stale' ? 'warning' : 'normal',
    },
    {
      label: 'CO2',
      value: formatNumber(currentData.co2, 0),
      unit: 'ppm',
      detail: `${temperatureSettings.co2Target ?? '-'} ppm target`,
      trendLabel: 'what-if input',
      icon: Leaf,
      tone: 'normal',
    },
    {
      label: 'RH',
      value: formatNumber(currentData.humidity, 0),
      unit: '%',
      detail: `VPD ${formatNumber(currentData.vpd, 2)} kPa`,
      trendLabel: currentData.vpd < 0.75 ? (locale === 'ko' ? '습도 주의' : 'Humidity watch') : 'stable',
      icon: Droplets,
      tone: currentData.vpd < 0.75 ? 'warning' : 'normal',
    },
    {
      label: locale === 'ko' ? '예상 수확' : 'Yield outlook',
      value: formatNumber(modelMetrics.yield.predictedWeekly, 1),
      unit: 'kg/wk',
      detail: `${Math.round(modelMetrics.yield.confidence * 100)}% confidence`,
      trendLabel: copy.model,
      icon: LineChart,
      tone: 'normal',
    },
    {
      label: 'RTR',
      value: profile ? formatNumber(profile.baseTempC, 1) : '-',
      unit: profile ? '°C base' : undefined,
      detail: profile?.strategyLabel ?? profileStatusLabel,
      trendLabel: profileStatusLabel,
      icon: CircleGauge,
      tone: profileStatusTone === 'warning' ? 'warning' : profileStatusTone === 'muted' ? 'muted' : 'normal',
    },
    {
      label: locale === 'ko' ? '시장 맥락' : 'Market context',
      value: selectedMarket?.item ? formatNumber(selectedMarket.item.day_over_day_pct, 1) : '-',
      unit: selectedMarket?.item ? '%' : undefined,
      detail: selectedMarket?.item.display_name ?? cropLabel,
      trend: selectedMarket?.item.direction === 'down' ? 'down' : selectedMarket?.item.direction === 'up' ? 'up' : 'stable',
      trendLabel: produceError ? (locale === 'ko' ? '시세 확인' : 'Check market') : selectedMarket?.item ? 'KAMIS' : marketPending ? 'loading' : 'pending',
      icon: CloudSun,
      tone: produceError ? 'warning' : selectedMarket?.item ? 'normal' : 'muted',
    },
    {
      label: locale === 'ko' ? '지식 표면' : 'Knowledge',
      value: knowledgeSummary ? `${readySurfaceCount}/${knowledgeSummary.surfaces.length}` : '-',
      detail: knowledgeLoading ? (locale === 'ko' ? '확인 중' : 'Loading') : knowledgeError ?? 'SmartGrow',
      trendLabel: knowledgeError ? (locale === 'ko' ? '확인 필요' : 'Check') : 'ready',
      icon: FlaskConical,
      tone: knowledgeError ? 'warning' : knowledgeSummary ? 'normal' : 'muted',
    },
  ];

  const actionCards: FeatureActionCard[] = [
    {
      title: copy.model,
      body: copy.modelBody,
      chip: '/api/models/scenario',
      icon: Calculator,
      tone: 'normal',
      actionLabel: locale === 'ko' ? '계산' : 'Run',
      href: '#scenario-model',
    },
    {
      title: copy.rtr,
      body: copy.rtrBody,
      chip: '/api/rtr/sensitivity',
      icon: CircleGauge,
      tone: optimizerEnabled ? 'normal' : 'warning',
      actionLabel: locale === 'ko' ? '비교' : 'Compare',
      href: '#scenario-rtr',
    },
    {
      title: locale === 'ko' ? '현재 환경 범위' : 'Current climate range',
      body: `Temp ${formatNumber(currentData.temperature, 1)}°C · CO2 ${formatNumber(currentData.co2, 0)} ppm · RH ${formatNumber(currentData.humidity, 0)}% · VPD ${formatNumber(currentData.vpd, 2)} kPa`,
      chip: telemetryStatus === 'offline' ? (locale === 'ko' ? '연결 확인' : 'Check link') : (locale === 'ko' ? '센서 기준' : 'Sensor basis'),
      icon: Activity,
      tone: telemetryStatus === 'offline' ? 'critical' : 'normal',
      actionLabel: locale === 'ko' ? '상세' : 'Details',
      href: '#scenario-model',
    },
    {
      title: locale === 'ko' ? '날씨·시세 맥락' : 'Weather-market context',
      body: weather?.summary ?? weatherError ?? (selectedMarket?.item ? `${selectedMarket.item.display_name} ${formatNumber(selectedMarket.item.day_over_day_pct, 1)}%` : 'Context feeds stay linked for scenario review.'),
      chip: weatherError || produceError ? (locale === 'ko' ? '확인 필요' : 'Check') : (locale === 'ko' ? '연동됨' : 'Connected'),
      icon: CloudSun,
      tone: weatherError || produceError ? 'warning' : 'normal',
      actionLabel: locale === 'ko' ? '인사이트' : 'Insights',
      to: '/trend',
    },
  ];

  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: copy.model,
      value: '/api/models/scenario',
      body: locale === 'ko' ? '온도·CO2·상대습도 입력 범위를 바꿔 과정기반모델 What-if를 실행합니다.' : 'Run process-model what-if calculations across temperature, CO2, and RH ranges.',
      chip: locale === 'ko' ? '실제 계산' : 'Model-backed',
      chipTone: 'growth',
      icon: Calculator,
      rows: [
        ['Temp', `${formatNumber(currentData.temperature, 1)}°C`],
        ['CO2', `${formatNumber(currentData.co2, 0)} ppm`],
      ],
      actionLabel: locale === 'ko' ? '실행' : 'Run',
      href: '#scenario-model',
    },
    {
      title: copy.rtr,
      value: optimizerEnabled ? copy.optimizerOn : copy.optimizerOff,
      body: profile?.sourceNote ?? profileStatusLabel,
      chip: profileStatusLabel,
      chipTone: profileStatusTone,
      icon: CircleGauge,
      rows: [
        [locale === 'ko' ? '기준온도' : 'Base temp', profile ? `${formatNumber(profile.baseTempC, 1)}°C` : '-'],
        [locale === 'ko' ? '허용편차' : 'Tolerance', profile ? `±${formatNumber(profile.toleranceC, 1)}°C` : '-'],
      ],
      actionLabel: locale === 'ko' ? '비교' : 'Compare',
      href: '#scenario-rtr',
    },
    {
      title: locale === 'ko' ? '자료 기반 검토' : 'Source-backed review',
      value: knowledgeSummary ? `${readySurfaceCount}/${knowledgeSummary.surfaces.length}` : '-',
      body: knowledgeSummary?.advisorySurfaceNames.slice(0, 3).join(', ') || knowledgeError || 'Knowledge and advisor context stay available for scenario interpretation.',
      chip: knowledgeError ? (locale === 'ko' ? '확인 필요' : 'Check') : (locale === 'ko' ? '연결됨' : 'Connected'),
      chipTone: knowledgeError ? 'warning' : 'growth',
      icon: FlaskConical,
      rows: [
        [cropLabel, knowledgeSummary?.cropKey ?? crop.toLowerCase()],
        ['KAMIS', selectedMarket?.item?.display_name ?? '-'],
      ],
      actionLabel: locale === 'ko' ? '질문' : 'Ask',
      onAction: onOpenAssistant,
    },
  ];

  return (
    <FeatureLandingFrame
      title={copy.title}
      description={copy.description}
      heroBadge={locale === 'ko' ? 'What-if · RTR · 오이 모델' : 'What-if · RTR · Cucumber model'}
      heroTitle={copy.heroTitle}
      heroBody={copy.heroBody}
      primaryAction={{ label: locale === 'ko' ? '모델 시나리오' : 'Model Scenario', href: '#scenario-model' }}
      secondaryAction={{ label: locale === 'ko' ? 'RTR 비교' : 'RTR Compare', href: '#scenario-rtr' }}
      preview={{
        eyebrow: 'SCENARIO LIVE',
        title: locale === 'ko' ? '과정기반모델 / RTR 편미분' : 'Process model / RTR sensitivity',
        statusLabel: optimizerEnabled ? copy.optimizerOn : copy.optimizerOff,
        statusTone: optimizerEnabled ? 'growth' : 'warning',
        metrics: [
          { label: 'Temp', value: `${formatNumber(currentData.temperature, 1)}°C`, detail: 'sensor' },
          { label: 'CO2', value: `${formatNumber(currentData.co2, 0)} ppm`, detail: 'input' },
          { label: 'Yield', value: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg`, detail: 'model' },
        ],
        chartLabel: locale === 'ko' ? '조정 범위' : 'Adjustment range',
        chartStatus: profile ? `±${formatNumber(profile.toleranceC, 1)}°C` : profileStatusLabel,
        chartValues: history.slice(-7).map((point) => point.temperature),
      }}
      metricsEyebrow="Live Overview"
      metricsFreshness={telemetryStatus ? `Telemetry ${telemetryStatus}` : copy.telemetry}
      metrics={metrics}
      actionsEyebrow={locale === 'ko' ? 'Scenario Action Board' : 'Scenario Action Board'}
      actionsTitle={locale === 'ko' ? '실제 계산으로 확인할 4가지' : 'Four backend-backed calculations to run'}
      actions={actionCards}
      comparisonEyebrow={locale === 'ko' ? '시나리오 최적화' : 'Scenario Optimizer'}
      comparisonTitle={locale === 'ko' ? '현재 관측과 RTR 기준 비교' : 'Current observation vs RTR guardrail'}
      comparisonStatusLabel={optimizerEnabled ? copy.optimizerOn : copy.optimizerOff}
      comparisonStatusTone={optimizerEnabled ? 'growth' : 'warning'}
      comparisonNote={cropLabel}
      baseline={{
        title: locale === 'ko' ? '현재 관측' : 'Current observation',
        subtitle: locale === 'ko' ? '센서 기반 기준선' : 'Sensor-based baseline',
        badgeCaption: 'MODEL',
        badgeLabel: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg/wk`,
        rows: [
          ['Temp', `${formatNumber(currentData.temperature, 1)}°C`],
          ['CO2', `${formatNumber(currentData.co2, 0)} ppm`],
          ['RH', `${formatNumber(currentData.humidity, 0)}%`],
          ['VPD', `${formatNumber(currentData.vpd, 2)} kPa`],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? 'RTR 기준' : 'RTR guardrail',
        subtitle: optimizerEnabled ? copy.optimizerOn : copy.optimizerOff,
        badgeCaption: 'RTR',
        badgeLabel: profile ? profile.strategyLabel : profileStatusLabel,
        rows: [
          [locale === 'ko' ? '기준온도' : 'Base temp', profile ? `${formatNumber(profile.baseTempC, 1)}°C` : '-'],
          [locale === 'ko' ? '기울기' : 'Slope', profile ? `${formatNumber(profile.slopeCPerMjM2, 2)}°C/MJ` : '-'],
          [locale === 'ko' ? '허용편차' : 'Tolerance', profile ? `±${formatNumber(profile.toleranceC, 1)}°C` : '-'],
          ['CO2', `${temperatureSettings.co2Target ?? '-'} ppm`],
        ],
      }}
      bridgeEyebrow={locale === 'ko' ? '모델 · RTR · 자료 연결' : 'Model · RTR · Knowledge Bridge'}
      bridgeTitle={locale === 'ko' ? '말이 아니라 실제 계산 표면으로 이동' : 'Move to the actual calculation surfaces'}
      bridgeCards={bridgeCards}
      detailEyebrow={locale === 'ko' ? 'SCENARIO FULL SURFACES' : 'SCENARIO FULL SURFACES'}
      detailTitle={locale === 'ko' ? 'What-if와 RTR 전체 기능' : 'Full What-if and RTR workspace'}
      detailDescription={locale === 'ko' ? '아래 영역은 기존 모델 런타임과 RTR optimizer 패널을 그대로 보존합니다.' : 'The panels below preserve the existing model runtime and RTR optimizer integrations.'}
      onOpenAssistant={onOpenAssistant}
    >
      {tabs.length > 0 ? (
        <PageSectionTabs tabs={tabs} activeId={activeTabId} onSelect={onSelectTab} />
      ) : null}
      <section id="scenario-model" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
        <ModelScenarioWorkbench crop={crop} />
      </section>
      <section id="scenario-rtr" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
        <Suspense
          fallback={(
            <LoadingSkeleton
              title="RTR Scenario"
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
    </FeatureLandingFrame>
  );
}
