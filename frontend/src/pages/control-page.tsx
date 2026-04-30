import type { ReactNode } from 'react';
import { Activity, CloudSun, Fan, Gauge, SlidersHorizontal, Thermometer, Zap } from 'lucide-react';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
} from '../components/dashboard/FeatureLandingFrame';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import { cn } from '../utils/cn';
import { appendFiniteValue, pickNumericSeries } from '../utils/metricTrendSeries';
import type {
  AdvancedModelMetrics,
  ControlStatus,
  CropType,
  RtrProfile,
  SensorData,
  TelemetryStatus,
  TemperatureSettings,
} from '../types';

export type ControlPagePanelId = 'control-strategy' | 'control-devices' | 'control-runtime';

interface ControlPageProps {
  locale: 'ko' | 'en';
  crop: CropType;
  activePanel: ControlPagePanelId;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  history: SensorData[];
  telemetryStatus: TelemetryStatus;
  temperatureSettings: TemperatureSettings;
  profile?: RtrProfile | null;
  controls: ControlStatus;
  strategySurface: ReactNode;
  controlSummary: ReactNode;
  environmentAdvisorSurface?: ReactNode;
  runtimeSurface?: ReactNode;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
  onCropChange?: (crop: CropType) => void;
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

function statusLabel(status: TelemetryStatus, locale: 'ko' | 'en'): string {
  if (locale === 'ko') {
    return ({
      live: '실시간',
      delayed: '지연',
      stale: '오래됨',
      offline: '수동 확인',
      loading: '연결 중',
    } as const)[status];
  }

  return ({
    live: 'Live',
    delayed: 'Delayed',
    stale: 'Stale',
    offline: 'Manual check',
    loading: 'Loading',
  } as const)[status];
}

function cropName(crop: CropType, locale: 'ko' | 'en'): string {
  if (locale !== 'ko') {
    return crop;
  }
  return crop === 'Cucumber' ? '오이' : '토마토';
}

export default function ControlPage({
  locale,
  crop,
  activePanel,
  currentData,
  modelMetrics,
  history,
  telemetryStatus,
  temperatureSettings,
  profile = null,
  controls,
  strategySurface,
  controlSummary,
  environmentAdvisorSurface = null,
  runtimeSurface,
  tabs = [],
  activeTabId,
  onSelectTab,
  onCropChange,
  onOpenAssistant,
}: ControlPageProps) {
  const englishCopy = {
    title: 'Climate',
    description: 'Climate decisions, temperature basis, humidity load, CO2, and power impact are kept in one calm view.',
    heroBadge: 'Climate decision summary',
    heroTitle: 'Review cucumber greenhouse climate before changing controls',
    heroBody: 'Read the decision signals first, then use the section tabs for detailed device or runtime operation.',
    primary: 'Climate solution',
    secondary: 'Ask assistant',
    live: 'Climate summary',
    freshness: 'Current growing-environment basis',
    actionsEyebrow: 'Before control',
    actionsTitle: 'Four checks before changing climate',
    comparisonEyebrow: 'Recommended basis',
    comparisonTitle: 'Current setpoints and recommended climate basis',
    bridgeEyebrow: 'Climate decision',
    bridgeTitle: 'Climate solution summary',
    detailEyebrow: 'Details',
    detailTitle: 'Climate detail workspace',
    detailDescription: 'Use the section tabs to keep climate solution, device state, and runtime operation separated.',
    open: 'Open',
    ready: 'Normal',
  };

  const text = locale === 'ko'
    ? {
        title: '온실 환경',
        description: '온도, 습도, 이산화탄소 기준을 중심으로 환경 판단만 정리합니다.',
        heroBadge: '환경 솔루션 요약',
        heroTitle: '오이 온실 환경을 바로 판단하는 제어 화면',
        heroBody: '필요한 판단만 먼저 보고, 세부 조정은 상단 세부 탭에서 진행합니다.',
        primary: '환경 솔루션',
        secondary: '질문하기',
        live: '환경 판단 요약',
        freshness: '현재 생육 환경 기준',
        actionsEyebrow: '제어 전 확인',
        actionsTitle: '지금 확인할 4가지',
        comparisonEyebrow: '권장 기준 비교',
        comparisonTitle: '현재 기준값과 권장 제어 기준',
        bridgeEyebrow: '환경 판단',
        bridgeTitle: '환경 솔루션 요약',
        detailEyebrow: '세부 기능',
        detailTitle: '온실 환경 세부 기능',
        detailDescription: '세부 탭에서 필요한 기능만 분리해 확인합니다.',
        open: '확인',
        ready: '정상',
      }
    : englishCopy;

  const activeDeviceCount = (['ventilation', 'irrigation', 'heating', 'shading'] as const)
    .filter((key) => controls[key]).length;
  const selectedCropName = cropName(crop, locale);
  const targetTemperature = (temperatureSettings.heating + temperatureSettings.cooling) / 2;
  const environmentStabilityValues = (history.length ? history.slice(-8) : [currentData]).map((point) => {
    const tempPenalty = Math.abs(point.temperature - targetTemperature) * 7;
    const vpdPenalty = Math.abs(point.vpd - 0.85) * 18;
    const co2Bonus = Math.min(Math.max((point.co2 - 450) / 12, 0), 28);
    return Math.max(18, Math.min(94, 68 + co2Bonus - tempPenalty - vpdPenalty));
  });
  const activeTab = activeTabId ?? activePanel;

  const metrics: FeatureMetric[] = [
    {
      label: locale === 'ko' ? '작물' : 'Runtime',
      value: locale === 'ko' ? selectedCropName : statusLabel(telemetryStatus, locale),
      detail: selectedCropName,
      trendLabel: telemetryStatus === 'live' ? text.ready : statusLabel(telemetryStatus, locale),
      icon: Activity,
      tone: telemetryStatus === 'live' ? 'normal' : 'warning',
      series: environmentStabilityValues,
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '환경 안정도 흐름' : 'Environment stability trend',
    },
    {
      label: locale === 'ko' ? '온도' : 'Air temp',
      value: formatNumber(currentData.temperature, 1),
      unit: '°C',
      detail: `${temperatureSettings.heating}-${temperatureSettings.cooling}°C`,
      trendLabel: locale === 'ko' ? '기준값' : 'setpoint',
      icon: Thermometer,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'temperature', 24), currentData.temperature, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '온도 흐름' : 'Air temperature trend',
    },
    {
      label: 'CO2',
      value: formatNumber(currentData.co2, 0),
      unit: 'ppm',
      detail: locale === 'ko' ? `목표 ${temperatureSettings.co2Target ?? 800} ppm` : `${temperatureSettings.co2Target ?? 800} ppm target`,
      trendLabel: locale === 'ko' ? '조정' : 'control',
      icon: CloudSun,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'co2', 24), currentData.co2, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '이산화탄소 흐름' : 'CO2 trend',
    },
    {
      label: locale === 'ko' ? '습도 부담' : 'VPD',
      value: formatNumber(currentData.vpd, 2),
      unit: 'kPa',
      detail: `${formatNumber(currentData.humidity, 0)}% RH`,
      trendLabel: locale === 'ko' ? '환경' : 'climate',
      icon: Gauge,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'vpd', 24), currentData.vpd, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '습도 부담 흐름' : 'VPD trend',
    },
    {
      label: locale === 'ko' ? '온도 기준' : 'RTR',
      value: profile ? formatNumber(profile.baseTempC, 1) : '-',
      unit: profile ? '°C' : undefined,
      detail: locale === 'ko' ? (profile ? '권장 기준 연결' : '기준 확인 중') : profile?.strategyLabel ?? 'profile pending',
      trendLabel: profile ? text.ready : (locale === 'ko' ? '대기' : 'pending'),
      icon: SlidersHorizontal,
      tone: profile ? 'normal' : 'muted',
      series: profile ? appendFiniteValue(pickNumericSeries(history, 'temperature', 24), profile.baseTempC, 24) : [],
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '권장온도 기준 흐름' : 'RTR basis trend',
    },
    {
      label: locale === 'ko' ? '광량' : 'Devices',
      value: locale === 'ko' ? formatNumber(currentData.light, 0) : `${activeDeviceCount}/4`,
      unit: locale === 'ko' ? 'µmol' : undefined,
      detail: locale === 'ko' ? '광합성 입력' : 'device signal',
      trendLabel: locale === 'ko' ? '광량' : activeDeviceCount ? 'manual' : 'standby',
      icon: locale === 'ko' ? CloudSun : Fan,
      tone: locale === 'ko' ? 'normal' : activeDeviceCount ? 'warning' : 'muted',
      series: appendFiniteValue(pickNumericSeries(history, 'light', 24), currentData.light, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '광량 흐름' : 'Light trend',
    },
    {
      label: locale === 'ko' ? '전력' : 'Power',
      value: formatNumber(modelMetrics.energy.consumption, 1),
      unit: 'kW',
      detail: `COP ${formatNumber(modelMetrics.energy.efficiency, 2)}`,
      trendLabel: locale === 'ko' ? '전력' : modelMetrics.energy.mode ?? 'energy',
      icon: Zap,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'energyUsage', 24), modelMetrics.energy.consumption, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '전력 사용 흐름' : 'Power demand trend',
    },
  ];

  const summaryActions: FeatureActionCard[] = [
    {
      title: locale === 'ko' ? '온도 기준' : 'Temperature basis',
      body: locale === 'ko' ? '현재 기준값과 권장 기준의 차이를 봅니다.' : 'Compare the current setpoint range with the recommended climate basis.',
      chip: locale === 'ko' ? '권장 확인' : 'Review',
      icon: SlidersHorizontal,
      tone: 'normal',
    },
    {
      title: locale === 'ko' ? '습도 부담' : 'Humidity load',
      body: locale === 'ko' ? '증산 부담이 과한지 먼저 봅니다.' : 'Check whether transpiration pressure is becoming excessive.',
      chip: `${formatNumber(currentData.vpd, 2)} kPa`,
      icon: Gauge,
      tone: currentData.vpd > 1.2 ? 'warning' : 'normal',
    },
    {
      title: locale === 'ko' ? '이산화탄소' : 'CO2 gap',
      body: locale === 'ko' ? '목표 농도와 현재 농도의 차이를 봅니다.' : 'Read the gap between current and target CO2.',
      chip: `${formatNumber(currentData.co2, 0)} ppm`,
      icon: CloudSun,
      tone: 'normal',
    },
    {
      title: locale === 'ko' ? '전력 영향' : 'Power impact',
      body: locale === 'ko' ? '환경 조정이 전력 사용에 미치는 영향을 봅니다.' : 'Estimate how climate adjustment affects power use.',
      chip: `${formatNumber(modelMetrics.energy.consumption, 1)} kW`,
      icon: Zap,
      tone: 'normal',
    },
  ];

  const summaryBridgeCards: FeatureBridgeCard[] = [
    {
      title: locale === 'ko' ? '환경 안정도' : 'Climate stability',
      value: locale === 'ko'
        ? `${formatNumber(environmentStabilityValues.at(-1), 0)}점`
        : `${formatNumber(environmentStabilityValues.at(-1), 0)} pts`,
      body: locale === 'ko' ? '온도·습도·이산화탄소 균형' : 'Temperature, humidity, and CO2 balance.',
      chip: text.ready,
      chipTone: 'growth',
      icon: Gauge,
      rows: [
        [locale === 'ko' ? '작물' : 'Crop', selectedCropName],
        [locale === 'ko' ? '습도 부담' : 'VPD', `${formatNumber(currentData.vpd, 2)} kPa`],
      ],
    },
    {
      title: locale === 'ko' ? '권장 기준' : 'Recommended basis',
      value: profile ? `${formatNumber(profile.baseTempC, 1)}°C` : (locale === 'ko' ? '대기' : 'Pending'),
      body: locale === 'ko' ? '현재 기준값과 권장 기준' : 'Current setpoints and recommended basis.',
      chip: profile ? text.ready : (locale === 'ko' ? '계산 대기' : 'Pending'),
      chipTone: profile ? 'growth' : 'warning',
      icon: SlidersHorizontal,
      rows: [
        [locale === 'ko' ? '난방' : 'Heating', `${temperatureSettings.heating}°C`],
        [locale === 'ko' ? '냉방' : 'Cooling', `${temperatureSettings.cooling}°C`],
      ],
    },
    {
      title: locale === 'ko' ? '생산 영향' : 'Production impact',
      value: locale === 'ko'
        ? `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg/주`
        : `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg/wk`,
      body: locale === 'ko' ? '환경 조정 후 수확 흐름' : 'Harvest flow after climate adjustment.',
      chip: text.ready,
      chipTone: 'growth',
      icon: Activity,
      rows: [
        [locale === 'ko' ? '전력' : 'Power', `${formatNumber(modelMetrics.energy.consumption, 1)} kW`],
        [locale === 'ko' ? '광량' : 'Light', `${formatNumber(currentData.light, 0)}`],
      ],
    },
  ];

  return (
    <FeatureLandingFrame
      title={text.title}
      description={text.description}
      heroBadge={text.heroBadge}
      heroTitle={text.heroTitle}
      heroBody={text.heroBody}
      primaryAction={{ label: text.primary, onClick: () => onSelectTab?.('control-strategy') }}
      secondaryAction={{ label: text.secondary, onClick: onOpenAssistant, variant: 'secondary' }}
      preview={{
        eyebrow: locale === 'ko' ? '환경 솔루션' : 'CONTROL LIVE',
        title: locale === 'ko' ? '온도 · 습도 · 이산화탄소' : 'Climate basis',
        statusLabel: statusLabel(telemetryStatus, locale),
        statusTone: telemetryStatus === 'live' ? 'growth' : 'warning',
        metrics: [
          { label: locale === 'ko' ? '온도' : 'Temp', value: `${formatNumber(currentData.temperature, 1)}°C` },
          { label: locale === 'ko' ? '습도' : 'Humidity', value: `${formatNumber(currentData.humidity, 0)}%` },
          { label: 'CO2', value: `${formatNumber(currentData.co2, 0)} ppm` },
        ],
        chartLabel: locale === 'ko' ? '환경 안정 흐름' : 'Climate stability',
        chartStatus: locale === 'ko' ? '온도·습도·CO2 균형' : 'Temp/RH/CO2 balance',
        chartValues: environmentStabilityValues,
      }}
      metricsEyebrow={text.live}
      metricsFreshness={text.freshness}
      metrics={metrics}
      actionsEyebrow={text.actionsEyebrow}
      actionsTitle={text.actionsTitle}
      actions={summaryActions}
      comparisonEyebrow={text.comparisonEyebrow}
      comparisonTitle={text.comparisonTitle}
      comparisonStatusLabel={profile ? text.ready : (locale === 'ko' ? '온도 기준 대기' : 'RTR pending')}
      comparisonStatusTone={profile ? 'growth' : 'warning'}
      comparisonNote={selectedCropName}
      baseline={{
        title: locale === 'ko' ? '현재 제어 기준' : 'Current setpoints',
        subtitle: locale === 'ko' ? '저장된 기준값' : '/api/config/ops',
        badgeCaption: locale === 'ko' ? '기준' : 'SET',
        badgeLabel: `${temperatureSettings.heating}-${temperatureSettings.cooling}°C`,
        rows: [
          [locale === 'ko' ? '난방' : 'Heat', `${temperatureSettings.heating}°C`],
          [locale === 'ko' ? '냉방' : 'Cool', `${temperatureSettings.cooling}°C`],
          ['CO2', `${temperatureSettings.co2Target ?? 800} ppm`],
          [locale === 'ko' ? '배액' : 'Drain', `${Math.round((temperatureSettings.drainTarget ?? 0.3) * 100)}%`],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '온도 기준' : 'RTR basis',
        subtitle: locale === 'ko' ? (profile ? '권장 기준' : '기준 확인 중') : profile?.strategyLabel ?? 'optimizer profile',
        badgeCaption: locale === 'ko' ? '권장' : 'RTR',
        badgeLabel: profile ? `${formatNumber(profile.baseTempC, 1)}°C` : '-',
        rows: [
          [locale === 'ko' ? '기준온도' : 'Base', profile ? `${formatNumber(profile.baseTempC, 1)}°C` : '-'],
          [locale === 'ko' ? '기울기' : 'Slope', profile ? formatNumber(profile.slopeCPerMjM2, 2) : '-'],
          [locale === 'ko' ? '허용폭' : 'Tolerance', profile ? `${formatNumber(profile.toleranceC, 1)}°C` : '-'],
          [locale === 'ko' ? '운전방식' : 'Mode', profile?.optimizer?.default_mode ?? '-'],
        ],
      }}
      bridgeEyebrow={text.bridgeEyebrow}
      bridgeTitle={text.bridgeTitle}
      bridgeCards={summaryBridgeCards}
      detailEyebrow={text.detailEyebrow}
      detailTitle={text.detailTitle}
      detailDescription={text.detailDescription}
      sectionTabs={tabs}
      activeSectionId={activeTab}
      onSelectSection={onSelectTab}
      onOpenAssistant={onOpenAssistant}
    >
      <div className="scroll-mt-24 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white/75 px-3 py-2 shadow-[var(--sg-shadow-card)]">
          <div className="min-w-0">
            <p className="sg-eyebrow">{locale === 'ko' ? '작물 기준' : 'Crop Context'}</p>
            <p className="mt-0.5 text-[0.72rem] font-semibold text-[color:var(--sg-text-muted)]">
              {locale === 'ko' ? '작물별 제어 상태와 기준값을 따로 관리합니다.' : 'Crop-scoped control state and setpoints stay preserved.'}
            </p>
          </div>
          <div className="flex shrink-0 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)] p-1" aria-label={locale === 'ko' ? '작물 전환' : 'Crop switch'}>
            {(['Cucumber', 'Tomato'] as const).map((cropOption) => (
              <button
                key={cropOption}
                type="button"
                aria-pressed={crop === cropOption}
                onClick={() => onCropChange?.(cropOption)}
                className={cn(
                  'rounded-[calc(var(--sg-radius-sm)-4px)] px-3 py-1 text-[0.68rem] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]',
                  crop === cropOption
                    ? 'bg-white text-[color:var(--sg-color-primary)] shadow-[var(--sg-shadow-card)]'
                    : 'text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)]',
                )}
              >
                {locale === 'ko' ? (cropOption === 'Cucumber' ? '오이' : '토마토') : cropOption}
              </button>
            ))}
          </div>
        </div>
        {activePanel === 'control-strategy' ? (
          <section id="control-strategy" className="grid grid-cols-1 gap-5 scroll-mt-24 xl:grid-cols-12" tabIndex={-1}>
            <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{strategySurface}</div>
            {environmentAdvisorSurface ? <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{environmentAdvisorSurface}</div> : null}
          </section>
        ) : null}
        {activePanel === 'control-devices' ? (
          <section id="control-devices" className="grid grid-cols-1 gap-5 scroll-mt-24 xl:grid-cols-12" tabIndex={-1}>
            <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{controlSummary}</div>
          </section>
        ) : null}
        {activePanel === 'control-runtime' ? (
          <section id="control-runtime" className="grid grid-cols-1 gap-5 scroll-mt-24 xl:grid-cols-12" tabIndex={-1}>
            {runtimeSurface ? <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{runtimeSurface}</div> : null}
          </section>
        ) : null}
      </div>
    </FeatureLandingFrame>
  );
}
