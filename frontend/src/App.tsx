import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Thermometer,
  Droplets,
  CloudFog,
  Sun,
  Activity,
  Leaf,
  MessageCircle,
  CircleGauge,
  BadgeAlert,
  FlaskConical,
  Sparkles,
} from 'lucide-react';
import AdvisorTabs from './components/advisor/AdvisorTabs';
import ControlPanel from './components/ControlPanel';
import CropDetails from './components/CropDetails';
import DashboardCard from './components/common/DashboardCard';
import AlertRail, { type AlertRailItem } from './components/dashboard/AlertRail';
import DecisionSnapshotGrid from './components/dashboard/DecisionSnapshotGrid';
import HeroControlCard from './components/dashboard/HeroControlCard';
import LiveMetricStrip from './components/dashboard/LiveMetricStrip';
import TodayBoard from './components/dashboard/TodayBoard';
import TopBar from './components/shell/TopBar';
import WorkspaceNav, { type DashboardWorkspaceKey, type WorkspaceNavItem } from './components/shell/WorkspaceNav';
import AdvisorPanelFallback from './features/advisor/AdvisorPanelFallback';
import LoadingSkeleton from './features/common/LoadingSkeleton';
import OverlayDrawerFallback from './features/chat/OverlayDrawerFallback';
import type { PromptAdvisorTabKey } from './components/advisor/advisorTabRegistry';
import type { RagAssistantOpenRequest } from './components/chat/RagAssistantDrawer';
import { useGreenhouse } from './hooks/useGreenhouse';
import { useAiAssistant } from './hooks/useAiAssistant';
import { useProducePrices } from './hooks/useProducePrices';
import { useRtrProfiles } from './hooks/useRtrProfiles';
import { useSmartGrowKnowledge } from './hooks/useSmartGrowKnowledge';
import { useWeatherOutlook } from './hooks/useWeatherOutlook';
import AppShell from './layout/AppShell';
import MainDashboard from './layout/MainDashboard';
import type { CropType, SensorData, SensorFieldAvailability, SensorFieldKey, SensorFieldState, TelemetryStatus } from './types';
import type { AppLocale } from './i18n/locale';
import { useLocale } from './i18n/LocaleProvider';
import { formatLocaleTime } from './i18n/locale';
import {
  getCropLabel,
  getDashboardSensorCopy,
  getDevelopmentStageLabel,
  NUMERIC_IDEAL_RANGES,
} from './utils/displayCopy';
import type { KpiTileData } from './components/KpiStrip';
import {
  buildDataStateSummary,
  buildStatusSummary,
  deriveSensorFieldState,
  deriveSensorStatus,
  getSensorFieldStateLabel,
} from './utils/sensorStatus';

const AiAdvisor = lazy(() => import('./components/AiAdvisor'));
const Charts = lazy(() => import('./components/Charts'));
const ChatAssistant = lazy(() => import('./components/ChatAssistant'));
const RagAssistantDrawer = lazy(() => import('./components/chat/RagAssistantDrawer'));
const ModelAnalytics = lazy(() => import('./components/ModelAnalytics'));
const ForecastPanel = lazy(() => import('./components/ForecastPanel'));
const ConsultingReport = lazy(() => import('./components/ConsultingReport'));
const SmartGrowSurfacePanel = lazy(() => import('./components/SmartGrowSurfacePanel'));
const WeatherOutlookPanel = lazy(() => import('./components/WeatherOutlookPanel'));
const ProducePricesPanel = lazy(() => import('./components/ProducePricesPanel'));
const RTROptimizerPanel = lazy(() => import('./components/RTROptimizerPanel'));

const CHAT_ASSISTANT_FALLBACK_COPY = {
  en: {
    title: 'Assistant',
    close: 'Close',
    loading: 'Loading AI assistant...',
  },
  ko: {
    title: '어시스턴트',
    close: '닫기',
    loading: '상담 도우미를 불러오는 중...',
  },
} as const;

const APP_COPY = {
  en: {
    brandTagline: 'Intelligent Greenhouse Decision Support',
    systemOnline: 'System Online',
    askAiAssistant: 'Ask AI Assistant',
    sensorLive: 'Live',
    sensorDelayed: 'Delayed',
    sensorLoading: 'Loading',
    sensorStale: 'Stale',
    sensorOffline: 'Offline',
    sensorMissing: 'Missing',
    sensorReceiving: 'Receiving data',
    sensorUnavailable: 'No live data',
    sensorUpdated: 'Updated',
    sensorUpdateDelayed: 'Update delayed',
    sensorConnectionLost: 'Connection lost',
    sensorDelta: '1h Δ',
    sensorSlope: '6h slope',
    language: 'Language',
    advancedModelAnalytics: 'Advanced Model Analytics',
    yieldForecast: 'Yield Forecast',
    consultingReport: 'Consulting Report',
    realTimeEnvironmentalAnalysis: 'Real-time Environmental Analysis',
    cropStatus: 'Crop Status',
    growthCycle: 'Growth Cycle',
    since: 'since',
    simTime: 'Sim Time',
    liveProducePrices: 'Live Produce Prices',
    daeguLiveWeather: 'Daegu Live Weather',
    rtrStrategy: 'RTR Strategy',
    smartGrowSurfaceTitle: 'SmartGrow Quick Actions',
    advancedModelAnalyticsLoading: 'Advanced Model Analytics module loading...',
    yieldForecastLoading: 'Yield Forecast module loading...',
    consultingReportLoading: 'Consulting Report module loading...',
    smartGrowSurfaceLoading: 'Loading SmartGrow quick actions...',
    realTimeEnvironmentalAnalysisLoading: 'Real-time Environmental Analysis module loading...',
    liveProducePricesLoading: 'Live Produce Prices module loading...',
    daeguLiveWeatherLoading: 'Daegu Live Weather module loading...',
    rtrStrategyLoading: 'RTR Strategy module loading...',
  },
  ko: {
    sensorLive: '실시간',
    sensorDelayed: '지연',
    sensorLoading: '로딩중',
    sensorStale: '오래됨',
    sensorOffline: '오프라인',
    sensorMissing: '미수신',
    sensorReceiving: '데이터 수신 중',
    sensorUnavailable: '실시간 데이터 없음',
    sensorUpdated: '최근 수집',
    sensorUpdateDelayed: '갱신 지연',
    sensorConnectionLost: '연결 끊김',
    sensorDelta: '1h 변화',
    sensorSlope: '6h 기울기',
    brandTagline: '스마트 온실 의사결정 지원',
    systemOnline: '시스템 정상',
    askAiAssistant: '상담 도우미',
    language: '언어',
    advancedModelAnalytics: '고급 모델 분석',
    yieldForecast: '수확 전망',
    consultingReport: '컨설팅 리포트',
    realTimeEnvironmentalAnalysis: '실시간 환경 분석',
    cropStatus: '작물 상태',
    growthCycle: '생육 사이클',
    since: '시작일',
    simTime: '시뮬레이션 시각',
    liveProducePrices: '실시간 농산물 가격',
    daeguLiveWeather: '대구 실시간 날씨',
    rtrStrategy: 'RTR 전략',
    smartGrowSurfaceTitle: '스마트 제어 바로가기',
    advancedModelAnalyticsLoading: '고급 모델 분석 모듈을 불러오는 중...',
    yieldForecastLoading: '수확 전망 모듈을 불러오는 중...',
    consultingReportLoading: '컨설팅 리포트 모듈을 불러오는 중...',
    smartGrowSurfaceLoading: '스마트 제어 바로가기를 불러오는 중...',
    realTimeEnvironmentalAnalysisLoading: '실시간 환경 분석 모듈을 불러오는 중...',
    liveProducePricesLoading: '실시간 농산물 가격 모듈을 불러오는 중...',
    daeguLiveWeatherLoading: '대구 실시간 날씨 모듈을 불러오는 중...',
    rtrStrategyLoading: 'RTR 전략 모듈을 불러오는 중...',
  },
} as const;

const RAG_ASSISTANT_FALLBACK_COPY = {
  en: {
    title: 'RAG Knowledge Search',
    close: 'Close',
    loading: 'Loading knowledge search...',
  },
  ko: {
    title: '지식 검색',
    close: '닫기',
    loading: '지식 검색 패널을 불러오는 중...',
  },
} as const;

const AUTO_ANALYSIS_INTERVAL_MS = 30 * 60 * 1000;
type SensorMetricKey = 'temperature' | 'humidity' | 'co2' | 'light' | 'vpd' | 'stomatalConductance';
type AdvisorOpenRequest = {
  tab: PromptAdvisorTabKey;
  showCorrectionTool?: boolean;
  nonce: number;
};
type RagAssistantLaunchRequest = Omit<RagAssistantOpenRequest, 'nonce'>;

type SensorTrendSummary = {
  trend: 'up' | 'down' | 'stable';
  delta1h: number | null;
  slope6h: number | null;
  sparklineValues: number[];
};

function findPointAtOrBefore(history: SensorData[], targetTimestamp: number): SensorData | null {
  let candidate: SensorData | null = null;

  for (const point of history) {
    if (point.timestamp > targetTimestamp) {
      break;
    }
    candidate = point;
  }

  return candidate;
}

function buildSensorTrendSummary(history: SensorData[], key: SensorMetricKey): SensorTrendSummary {
  const availableHistory = history.filter(
    (point) => point.fieldAvailability?.[key] !== false,
  );
  const lastPoint = availableHistory[availableHistory.length - 1];
  const sparklineValues = availableHistory
    .slice(-18)
    .map((point) => point[key])
    .filter((value) => Number.isFinite(value));

  if (!lastPoint) {
    return {
      trend: 'stable',
      delta1h: null,
      slope6h: null,
      sparklineValues,
    };
  }

  const oneHourPoint = findPointAtOrBefore(availableHistory, lastPoint.timestamp - 60 * 60 * 1000);
  const sixHourPoint = findPointAtOrBefore(availableHistory, lastPoint.timestamp - 6 * 60 * 60 * 1000);
  const delta1h = oneHourPoint ? lastPoint[key] - oneHourPoint[key] : null;
  const slope6h = sixHourPoint
    ? (lastPoint[key] - sixHourPoint[key]) / Math.max((lastPoint.timestamp - sixHourPoint.timestamp) / 3_600_000, 1e-9)
    : null;
  const range = sparklineValues.length > 0
    ? Math.max(...sparklineValues) - Math.min(...sparklineValues)
    : 0;
  const sensitivity = Math.max(range * 0.2, Math.abs(lastPoint[key]) * 0.03, 0.05);

  let trend: SensorTrendSummary['trend'] = 'stable';
  if (delta1h !== null && Math.abs(delta1h) >= sensitivity) {
    trend = delta1h > 0 ? 'up' : 'down';
  } else if (slope6h !== null && Math.abs(slope6h) >= sensitivity / 6) {
    trend = slope6h > 0 ? 'up' : 'down';
  }

  return {
    trend,
    delta1h,
    slope6h,
    sparklineValues,
  };
}

function formatRelativeAge(ageMs: number, locale: AppLocale): string {
  if (ageMs < 60_000) {
    const seconds = Math.max(1, Math.round(ageMs / 1000));
    return locale === 'ko' ? `${seconds}초 전` : `${seconds}s ago`;
  }

  const minutes = Math.max(1, Math.round(ageMs / 60_000));
  return locale === 'ko' ? `${minutes}분 전` : `${minutes}m ago`;
}

function formatLastCollectedAt(
  timestamp: number | null,
  clock: number,
  locale: AppLocale,
): string | null {
  if (!timestamp) {
    return null;
  }

  const absolute = formatLocaleTime(locale, timestamp, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const relative = formatRelativeAge(Math.max(0, clock - timestamp), locale);
  return `${absolute} · ${relative}`;
}

function formatSignedMetric(value: number | null, fractionDigits = 1): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(fractionDigits)}`;
}

function resolveSensorDisplayState(
  fieldKey: SensorFieldKey,
  telemetryStatus: TelemetryStatus,
  availability: SensorFieldAvailability,
): SensorFieldState {
  return deriveSensorFieldState(availability[fieldKey], telemetryStatus);
}

function App() {
  const { locale, setLocale } = useLocale();
  const copy = APP_COPY[locale];
  const sensorCopy = getDashboardSensorCopy(locale);
  const {
    currentData,
    modelMetrics,
    history,
    metricHistory,
    forecast,
    controls,
    toggleControl,
    setControlValue,
    selectedCrop,
    setSelectedCrop,
    telemetry,
    sensorFieldAvailability,
    sensorFieldTimestamps,
    setTempSettings,
    growthDay,
    startDateLabel,
    currentDateLabel
  } = useGreenhouse();

  const {
    aiAnalysis,
    aiDisplay,
    aiModelRuntime,
    aiError,
    isAnalyzing,
    analyzeData
  } = useAiAssistant();
  const {
    weather,
    loading: isWeatherLoading,
    error: weatherError,
  } = useWeatherOutlook();
  const {
    prices: producePrices,
    loading: isProducePricesLoading,
    error: producePricesError,
  } = useProducePrices();
  const {
    profiles: rtrProfilesPayload,
    loading: isRtrProfileLoading,
    error: rtrProfileError,
    refresh: refreshRtrProfiles,
  } = useRtrProfiles();
  const {
    summary: smartGrowSummary,
    loading: isSmartGrowLoading,
    error: smartGrowError,
  } = useSmartGrowKnowledge(selectedCrop);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [shouldRenderChat, setShouldRenderChat] = useState(false);
  const [isRagAssistantOpen, setIsRagAssistantOpen] = useState(false);
  const [shouldRenderRagAssistant, setShouldRenderRagAssistant] = useState(false);
  const [ragAssistantRequest, setRagAssistantRequest] = useState<RagAssistantOpenRequest | null>(null);
  const [isAdvisorTabsOpen, setIsAdvisorTabsOpen] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<DashboardWorkspaceKey>('command');
  const [telemetryClock, setTelemetryClock] = useState(() => Date.now());
  const [advisorOpenRequest, setAdvisorOpenRequest] = useState<AdvisorOpenRequest | null>(null);
  const advisorTabsAnchorRef = useRef<HTMLDivElement | null>(null);
  const lastAutoAnalysisRef = useRef<Record<CropType, { telemetryTimestamp: number; marketFetchedAt: string | null }>>({
    Tomato: { telemetryTimestamp: 0, marketFetchedAt: null },
    Cucumber: { telemetryTimestamp: 0, marketFetchedAt: null },
  });
  const deferredHistory = useDeferredValue(history);
  const deferredMetricHistory = useDeferredValue(metricHistory);
  const deferredForecast = useDeferredValue(forecast);
  const deferredModelMetrics = useDeferredValue(modelMetrics);
  const hasTelemetryData = history.length > 0 || telemetry.lastMessageAt !== null;
  const unresolvedSensorValue = telemetry.status === 'offline'
    ? copy.sensorUnavailable
    : copy.sensorReceiving;
  const temperatureTrend = buildSensorTrendSummary(history, 'temperature');
  const humidityTrend = buildSensorTrendSummary(history, 'humidity');
  const co2Trend = buildSensorTrendSummary(history, 'co2');
  const lightTrend = buildSensorTrendSummary(history, 'light');
  const vpdTrend = buildSensorTrendSummary(history, 'vpd');
  const stomatalTrend = buildSensorTrendSummary(history, 'stomatalConductance');

  const buildTrendDetail = useCallback((trendSummary: SensorTrendSummary, unit: string, digits = 1) => {
    const delta = formatSignedMetric(trendSummary.delta1h, digits);
    const slope = formatSignedMetric(trendSummary.slope6h, digits);
    const parts = [
      delta ? `${copy.sensorDelta} ${delta} ${unit}` : null,
      slope ? `${copy.sensorSlope} ${slope} ${unit}/h` : null,
    ].filter((value): value is string => Boolean(value));

    return parts.join(' · ');
  }, [copy.sensorDelta, copy.sensorSlope]);

  const cropRanges = NUMERIC_IDEAL_RANGES[selectedCrop];
  const temperatureState = resolveSensorDisplayState('temperature', telemetry.status, sensorFieldAvailability);
  const humidityState = resolveSensorDisplayState('humidity', telemetry.status, sensorFieldAvailability);
  const co2State = resolveSensorDisplayState('co2', telemetry.status, sensorFieldAvailability);
  const lightState = resolveSensorDisplayState('light', telemetry.status, sensorFieldAvailability);
  const vpdState = resolveSensorDisplayState('vpd', telemetry.status, sensorFieldAvailability);
  const stomatalState = resolveSensorDisplayState('stomatalConductance', telemetry.status, sensorFieldAvailability);
  const tempStatus = deriveSensorStatus(
    sensorFieldAvailability.temperature && hasTelemetryData ? currentData.temperature : null,
    cropRanges.temperature,
  );
  const humidityStatus = deriveSensorStatus(
    sensorFieldAvailability.humidity && hasTelemetryData ? currentData.humidity : null,
    cropRanges.humidity,
  );
  const co2Status = deriveSensorStatus(
    sensorFieldAvailability.co2 && hasTelemetryData ? currentData.co2 : null,
    cropRanges.co2,
  );
  const lightStatus = deriveSensorStatus(
    sensorFieldAvailability.light && hasTelemetryData ? currentData.light : null,
    cropRanges.light,
  );
  const vpdStatus = deriveSensorStatus(
    sensorFieldAvailability.vpd && hasTelemetryData ? currentData.vpd : null,
    cropRanges.vpd,
  );
  const stomatalStatus = deriveSensorStatus(
    sensorFieldAvailability.stomatalConductance && hasTelemetryData ? currentData.stomatalConductance : null,
    cropRanges.stomatalConductance,
  );
  const dataStateSummary = buildDataStateSummary(
    [temperatureState, humidityState, co2State, lightState],
    locale,
  );
  const healthSummary = buildStatusSummary([tempStatus, humidityStatus, co2Status, lightStatus], locale);
  const kpiStatusSummary = [temperatureState, humidityState, co2State, lightState].some(
    (state) => state === 'missing' || state === 'offline',
  )
    ? dataStateSummary
    : `${dataStateSummary} · ${healthSummary}`;
  const buildFieldAgeLabel = useCallback((fieldKey: SensorFieldKey): string | null =>
    formatLastCollectedAt(sensorFieldTimestamps[fieldKey], telemetryClock, locale),
  [locale, sensorFieldTimestamps, telemetryClock]);
  const buildKpiValue = useCallback((fieldKey: SensorFieldKey, value: number) => {
    const state = resolveSensorDisplayState(fieldKey, telemetry.status, sensorFieldAvailability);
    return state === 'missing' ? unresolvedSensorValue : value;
  }, [sensorFieldAvailability, telemetry.status, unresolvedSensorValue]);

  const primaryKpiTiles = useMemo<KpiTileData[]>(() => [
    {
      key: 'temperature',
      label: sensorCopy.temperature.title,
      value: hasTelemetryData ? buildKpiValue('temperature', currentData.temperature) : unresolvedSensorValue,
      unit: sensorCopy.temperature.unit,
      availabilityState: temperatureState,
      availabilityLabel: getSensorFieldStateLabel(temperatureState, locale),
      healthStatus: tempStatus,
      trend: temperatureTrend.trend,
      trendDetail: temperatureState === 'missing' ? '' : buildTrendDetail(temperatureTrend, sensorCopy.temperature.unit),
      icon: Thermometer,
      color: 'bg-orange-500',
      lastReceived: buildFieldAgeLabel('temperature'),
    },
    {
      key: 'humidity',
      label: sensorCopy.humidity.title,
      value: hasTelemetryData ? buildKpiValue('humidity', currentData.humidity) : unresolvedSensorValue,
      unit: sensorCopy.humidity.unit,
      availabilityState: humidityState,
      availabilityLabel: getSensorFieldStateLabel(humidityState, locale),
      healthStatus: humidityStatus,
      trend: humidityTrend.trend,
      trendDetail: humidityState === 'missing' ? '' : buildTrendDetail(humidityTrend, sensorCopy.humidity.unit),
      icon: Droplets,
      color: 'bg-blue-500',
      lastReceived: buildFieldAgeLabel('humidity'),
    },
    {
      key: 'co2',
      label: sensorCopy.carbonDioxide.title,
      value: hasTelemetryData ? buildKpiValue('co2', currentData.co2) : unresolvedSensorValue,
      unit: sensorCopy.carbonDioxide.unit,
      availabilityState: co2State,
      availabilityLabel: getSensorFieldStateLabel(co2State, locale),
      healthStatus: co2Status,
      trend: co2Trend.trend,
      trendDetail: co2State === 'missing' ? '' : buildTrendDetail(co2Trend, sensorCopy.carbonDioxide.unit),
      icon: CloudFog,
      color: 'bg-slate-600',
      lastReceived: buildFieldAgeLabel('co2'),
    },
    {
      key: 'light',
      label: sensorCopy.light.title,
      value: hasTelemetryData ? buildKpiValue('light', currentData.light) : unresolvedSensorValue,
      unit: sensorCopy.light.unit,
      availabilityState: lightState,
      availabilityLabel: getSensorFieldStateLabel(lightState, locale),
      healthStatus: lightStatus,
      trend: lightTrend.trend,
      trendDetail: lightState === 'missing' ? '' : buildTrendDetail(lightTrend, sensorCopy.light.unit),
      icon: Sun,
      color: 'bg-yellow-500',
      lastReceived: buildFieldAgeLabel('light'),
    },
  ], [
    buildFieldAgeLabel,
    buildKpiValue,
    buildTrendDetail,
    co2State,
    co2Status,
    co2Trend,
    currentData.co2,
    currentData.humidity,
    currentData.light,
    currentData.temperature,
    hasTelemetryData,
    humidityState,
    humidityStatus,
    humidityTrend,
    lightState,
    lightStatus,
    lightTrend,
    locale,
    sensorCopy.carbonDioxide.title,
    sensorCopy.carbonDioxide.unit,
    sensorCopy.humidity.title,
    sensorCopy.humidity.unit,
    sensorCopy.light.title,
    sensorCopy.light.unit,
    sensorCopy.temperature.title,
    sensorCopy.temperature.unit,
    tempStatus,
    temperatureState,
    temperatureTrend,
    unresolvedSensorValue,
  ]);

  const secondaryKpiTiles = useMemo<KpiTileData[]>(() => [
    {
      key: 'vpd',
      label: sensorCopy.vpd.title,
      value: hasTelemetryData ? buildKpiValue('vpd', currentData.vpd) : unresolvedSensorValue,
      unit: sensorCopy.vpd.unit,
      availabilityState: vpdState,
      availabilityLabel: getSensorFieldStateLabel(vpdState, locale),
      healthStatus: vpdStatus,
      trend: vpdTrend.trend,
      trendDetail: vpdState === 'missing' ? '' : buildTrendDetail(vpdTrend, sensorCopy.vpd.unit, 2),
      icon: Activity,
      color: 'bg-purple-500',
      lastReceived: buildFieldAgeLabel('vpd'),
      fractionDigits: 2,
    },
    {
      key: 'stomatalConductance',
      label: sensorCopy.stomatalConductance.title,
      value: hasTelemetryData ? buildKpiValue('stomatalConductance', currentData.stomatalConductance) : unresolvedSensorValue,
      unit: sensorCopy.stomatalConductance.unit,
      availabilityState: stomatalState,
      availabilityLabel: getSensorFieldStateLabel(stomatalState, locale),
      healthStatus: stomatalStatus,
      trend: stomatalTrend.trend,
      trendDetail: stomatalState === 'missing' ? '' : buildTrendDetail(stomatalTrend, sensorCopy.stomatalConductance.unit, 3),
      icon: Leaf,
      color: 'bg-green-500',
      lastReceived: buildFieldAgeLabel('stomatalConductance'),
      fractionDigits: 3,
    },
  ], [
    buildFieldAgeLabel,
    buildKpiValue,
    buildTrendDetail,
    currentData.stomatalConductance,
    currentData.vpd,
    hasTelemetryData,
    locale,
    sensorCopy.stomatalConductance.title,
    sensorCopy.stomatalConductance.unit,
    sensorCopy.vpd.title,
    sensorCopy.vpd.unit,
    stomatalState,
    stomatalStatus,
    stomatalTrend,
    unresolvedSensorValue,
    vpdState,
    vpdStatus,
    vpdTrend,
  ]);
  const selectedCropLabel = getCropLabel(selectedCrop, locale);
  const selectedRtrProfile = rtrProfilesPayload?.profiles[selectedCrop] ?? null;
  const optimizerEnabled =
    selectedRtrProfile?.optimizer?.enabled
    ?? rtrProfilesPayload?.optimizerEnabled
    ?? false;
  const telemetryDetail = formatLastCollectedAt(telemetry.lastMessageAt, telemetryClock, locale);
  const runtimeViolations = aiModelRuntime?.constraint_checks?.violated_constraints ?? [];
  const runtimeRecommendedAction =
    aiModelRuntime?.scenario?.recommended?.action
    ?? aiModelRuntime?.recommendations?.[0]?.action
    ?? null;
  const heroCopy = useMemo(() => (
    locale === 'ko'
      ? {
        fallbackSummary: '오늘 제어 우선순위와 모델 기반 추천을 한 화면에서 정리했습니다.',
        telemetryStale: '센서 갱신이 지연되어 신뢰도가 낮아졌습니다.',
        telemetryOffline: '실시간 텔레메트리가 끊겨 수동 확인이 필요합니다.',
        optimizerReady: 'RTR 최적화와 제어 시나리오를 바로 비교할 수 있습니다.',
        optimizerBlocked: 'RTR 추천은 기준선 fallback 중심으로 제한됩니다.',
        commandTrayTitle: '오늘 운영 방향',
        commandTrayDescription: '오늘 바로 열어야 할 워크스페이스와 핵심 운영 포인트를 정리했습니다.',
        jumpAdvisor: '어드바이저 보기',
        jumpRtr: 'RTR 스튜디오',
        jumpKnowledge: '지식 검색',
        jumpAlerts: '알림 점검',
        jumpWeather: '날씨와 자원',
        commandCenter: '커맨드 센터',
        advisor: '어드바이저',
        rtr: 'RTR · 제어 스튜디오',
        crop: '생육 · 작업',
        resources: '자원 · 비용',
        alerts: '알림 · 경보',
        knowledge: '지식 · 어시스턴트',
        commandDesc: '오늘 상태, 추천 행동, 핵심 제어',
        advisorDesc: '환경, 생리, 작업, 양액, 방제 추천',
        rtrDesc: 'RTR 최적화, 시나리오, 민감도',
        cropDesc: '생육, 작업, 수확 추세',
        resourcesDesc: '에너지, 물, 가격, 비용',
        alertsDesc: '위험, 차단 요인, 조치 로그',
        knowledgeDesc: '근거 검색과 대화형 설명',
        alertsWorkspaceTitle: '경보 및 운영 확인',
        alertsWorkspaceDescription: '센서 상태, 제약 위반, 운영 리스크를 한곳에서 점검합니다.',
        resourcesTitle: '자원 및 비용',
        resourcesDescription: '날씨, 가격, 에너지, 자원 흐름을 운영 의사결정과 연결합니다.',
        knowledgeTitle: '지식 검색 · 어시스턴트',
        knowledgeDescription: '근거 검색, AI 설명, 계산 배경을 한곳에서 엽니다.',
        knowledgePrompt: '필요한 근거를 바로 열어보고, AI 설명과 지식 검색을 나란히 활용하세요.',
        knowledgeAssistant: '어시스턴트 열기',
        knowledgeRag: '지식 검색 열기',
        confidenceLead: '모델 신뢰도',
        freshnessLead: '텔레메트리 상태',
        workingModeLead: '현재 운영 모드',
        scenarioReady: '시나리오 비교 가능',
        cropSnapshot: '생육 스냅샷',
        cropSnapshotDescription: '현재 생육 단계와 수동 제어 상태를 함께 확인합니다.',
        telemetryLive: '실시간 데이터가 정상 수신 중입니다.',
      }
      : {
        fallbackSummary: 'The command center organizes today’s operating actions and model-backed guidance in one canvas.',
        telemetryStale: 'Telemetry is delayed, so recommendation confidence is reduced.',
        telemetryOffline: 'Live telemetry is offline, so a manual greenhouse check is required.',
        optimizerReady: 'RTR optimization and control scenarios are ready to compare.',
        optimizerBlocked: 'RTR recommendations are currently limited to baseline fallback behavior.',
        commandTrayTitle: 'Today operating focus',
        commandTrayDescription: 'Jump directly into the workspace that matters most for the next decision.',
        jumpAdvisor: 'Open advisor',
        jumpRtr: 'RTR studio',
        jumpKnowledge: 'Knowledge search',
        jumpAlerts: 'Review alerts',
        jumpWeather: 'Weather and resources',
        commandCenter: 'Command Center',
        advisor: 'Advisor',
        rtr: 'RTR & Control Studio',
        crop: 'Crop & Work',
        resources: 'Resources',
        alerts: 'Alerts',
        knowledge: 'Knowledge & Assistant',
        commandDesc: 'Today status, actions, and key controls',
        advisorDesc: 'Environment, physiology, work, nutrient, pesticide',
        rtrDesc: 'RTR optimizer, scenarios, and sensitivity',
        cropDesc: 'Growth, work pressure, and harvest trend',
        resourcesDesc: 'Energy, water, prices, and operating cost',
        alertsDesc: 'Risks, blockers, and response flow',
        knowledgeDesc: 'Evidence search and AI explanation',
        alertsWorkspaceTitle: 'Alerts and operator checks',
        alertsWorkspaceDescription: 'Review telemetry state, runtime violations, and operating risks in one place.',
        resourcesTitle: 'Resources and economics',
        resourcesDescription: 'Connect weather, market, energy, and resource use to decisions.',
        knowledgeTitle: 'Knowledge & Assistant',
        knowledgeDescription: 'Open evidence search, AI explanation, and supporting references in one place.',
        knowledgePrompt: 'Keep the knowledge drawer and assistant close when you need evidence-backed explanation.',
        knowledgeAssistant: 'Open assistant',
        knowledgeRag: 'Open knowledge search',
        confidenceLead: 'Model confidence',
        freshnessLead: 'Telemetry freshness',
        workingModeLead: 'Operating mode',
        scenarioReady: 'Scenario compare ready',
        cropSnapshot: 'Crop snapshot',
        cropSnapshotDescription: 'See crop progress and manual control state together.',
        telemetryLive: 'Live telemetry is arriving on time.',
      }
  ), [locale]);

  const handleChatToggle = useCallback(() => {
    setShouldRenderChat(true);
    if (!isChatOpen) {
      setActiveWorkspace('knowledge');
    }
    setIsChatOpen((prev) => !prev);
  }, [isChatOpen]);

  const handleOpenRagAssistant = useCallback((request?: RagAssistantLaunchRequest) => {
    setShouldRenderRagAssistant(true);
    setActiveWorkspace('knowledge');
    const defaultRequest: RagAssistantLaunchRequest = smartGrowSummary?.nutrientCorrectionReady
      ? {
          preset: 'nutrient',
          query: locale === 'ko'
            ? `${selectedCropLabel} 양액 보정 경계 조건과 수동 검토 항목`
            : `${selectedCropLabel} nutrient correction guardrails and manual review items`,
          autoRun: true,
          source: 'dashboard',
        }
      : smartGrowSummary?.nutrientReady
        ? {
            preset: 'nutrient',
            query: locale === 'ko'
              ? `${selectedCropLabel} 현재 단계 양액 레시피와 경계 조건`
              : `${selectedCropLabel} nutrient recipe and guardrails for the current stage`,
            autoRun: true,
            source: 'dashboard',
          }
        : smartGrowSummary?.pesticideReady
          ? {
              preset: 'pesticide',
              query: locale === 'ko'
                ? `${selectedCropLabel} 주요 병해충 후보와 교호 전략`
                : `${selectedCropLabel} disease and pesticide rotation guidance`,
              autoRun: true,
              source: 'dashboard',
            }
          : {
              preset: 'general',
              query: locale === 'ko'
                ? `${selectedCropLabel} 생육 관리 핵심`
                : `Main cultivation guidance for ${selectedCropLabel}`,
              autoRun: true,
              source: 'dashboard',
            };
    setRagAssistantRequest({
      ...defaultRequest,
      ...request,
      nonce: Date.now(),
    });
    setIsRagAssistantOpen(true);
  }, [locale, selectedCropLabel, smartGrowSummary]);

  const handleOpenAdvisorTabs = useCallback((
    tab: PromptAdvisorTabKey = 'environment',
    options?: { showCorrectionTool?: boolean },
  ) => {
    setActiveWorkspace('advisor');
    setAdvisorOpenRequest({
      tab,
      showCorrectionTool: options?.showCorrectionTool ?? false,
      nonce: Date.now(),
    });
    setIsAdvisorTabsOpen(true);
    requestAnimationFrame(() => {
      advisorTabsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleOpenSmartGrowSurface = useCallback((surfaceKey: 'pesticide' | 'nutrient' | 'nutrient_correction') => {
    if (surfaceKey === 'pesticide') {
      handleOpenAdvisorTabs('pesticide');
      return;
    }
    if (surfaceKey === 'nutrient_correction') {
      handleOpenAdvisorTabs('nutrient', { showCorrectionTool: true });
      return;
    }
    handleOpenAdvisorTabs('nutrient');
  }, [handleOpenAdvisorTabs]);

  useEffect(() => {
    if (telemetry.lastMessageAt === null) {
      return;
    }

    const syncClock = () => {
      setTelemetryClock(Date.now());
    };

    const initialTimeout = window.setTimeout(syncClock, 0);
    const interval = window.setInterval(() => {
      syncClock();
    }, 30_000);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, [telemetry.lastMessageAt, telemetry.status]);

  // Trigger analysis
  const handleAnalyze = useCallback(() => {
    if (!hasTelemetryData || telemetry.status === 'loading') {
      return;
    }

    analyzeData(
      currentData,
      modelMetrics,
      selectedCrop,
      history,
      forecast,
      producePrices,
      weather,
      rtrProfilesPayload?.profiles[selectedCrop] ?? null,
      (recommendations) => {
        const normalizedRecommendations = recommendations.map((recommendation) => recommendation.toLowerCase());
        if (normalizedRecommendations.some((recommendation) => recommendation.includes('vent') || recommendation.includes('환기'))) {
          setControlValue('ventilation', true);
        }
        if (normalizedRecommendations.some((recommendation) => recommendation.includes('irrig') || recommendation.includes('관수'))) {
          setControlValue('irrigation', true);
        }
        if (normalizedRecommendations.some((recommendation) => recommendation.includes('heat') || recommendation.includes('난방'))) {
          setControlValue('heating', true);
        }
        if (normalizedRecommendations.some((recommendation) => recommendation.includes('shade') || recommendation.includes('차광'))) {
          setControlValue('shading', true);
        }
      });
  }, [
    analyzeData,
    currentData,
    forecast,
    hasTelemetryData,
    history,
    modelMetrics,
    producePrices,
    rtrProfilesPayload,
    selectedCrop,
    setControlValue,
    telemetry.status,
    weather,
  ]);

  // Auto analysis when actual data has arrived for the selected crop.
  useEffect(() => {
    const latestTimestamp = history[history.length - 1]?.timestamp
      ?? (hasTelemetryData ? currentData.timestamp : 0);
    const latestMarketFetchedAt = producePrices?.source.fetched_at ?? null;

    if (!latestTimestamp || telemetry.status === 'loading') {
      return;
    }

    const lastAuto = lastAutoAnalysisRef.current[selectedCrop];
    const telemetryNeedsRefresh =
      lastAuto.telemetryTimestamp === 0
      || latestTimestamp - lastAuto.telemetryTimestamp >= AUTO_ANALYSIS_INTERVAL_MS;
    const marketNeedsRefresh =
      latestMarketFetchedAt !== null
      && latestMarketFetchedAt !== lastAuto.marketFetchedAt;
    const shouldAnalyze = telemetryNeedsRefresh || marketNeedsRefresh;
    if (!shouldAnalyze) {
      return;
    }

    const timer = setTimeout(() => {
      lastAutoAnalysisRef.current[selectedCrop] = {
        telemetryTimestamp: latestTimestamp,
        marketFetchedAt: latestMarketFetchedAt,
      };
      handleAnalyze();
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentData.timestamp, handleAnalyze, hasTelemetryData, history, producePrices, selectedCrop, telemetry.status]);

  const workspaceItems = useMemo<WorkspaceNavItem[]>(() => [
    { key: 'command', label: heroCopy.commandCenter, shortLabel: locale === 'ko' ? '명령' : 'Command', description: heroCopy.commandDesc, icon: Sparkles },
    { key: 'advisor', label: heroCopy.advisor, shortLabel: locale === 'ko' ? '조언' : 'Advisor', description: heroCopy.advisorDesc, icon: MessageCircle },
    { key: 'rtr', label: heroCopy.rtr, shortLabel: 'RTR', description: heroCopy.rtrDesc, icon: CircleGauge },
    { key: 'crop', label: heroCopy.crop, shortLabel: locale === 'ko' ? '생육' : 'Crop', description: heroCopy.cropDesc, icon: Leaf },
    { key: 'resources', label: heroCopy.resources, shortLabel: locale === 'ko' ? '자원' : 'Resource', description: heroCopy.resourcesDesc, icon: FlaskConical },
    { key: 'alerts', label: heroCopy.alerts, shortLabel: locale === 'ko' ? '경보' : 'Alerts', description: heroCopy.alertsDesc, icon: BadgeAlert },
    { key: 'knowledge', label: heroCopy.knowledge, shortLabel: locale === 'ko' ? '지식' : 'Knowledge', description: heroCopy.knowledgeDesc, icon: MessageCircle },
  ], [heroCopy, locale]);

  const heroPrimaryNarrative = runtimeRecommendedAction
    ? (locale === 'ko' ? `지금: ${runtimeRecommendedAction}` : `Now: ${runtimeRecommendedAction}`)
    : telemetry.status === 'offline'
      ? heroCopy.telemetryOffline
      : telemetry.status === 'stale' || telemetry.status === 'delayed'
        ? heroCopy.telemetryStale
        : optimizerEnabled
          ? heroCopy.optimizerReady
          : heroCopy.optimizerBlocked;

  const smartGrowHeroSummary = smartGrowSummary
    ? smartGrowSummary.advisorySurfaceNames.length > 0
      ? (
          locale === 'ko'
            ? `지식 기반 surface ${smartGrowSummary.advisorySurfaceNames.join(', ')}를 바로 열어 운영 판단에 연결할 수 있습니다.`
            : `Knowledge-backed surfaces ${smartGrowSummary.advisorySurfaceNames.join(', ')} are ready to support the next operating decision.`
        )
      : smartGrowSummary.pendingParsers.length > 0
        ? (
            locale === 'ko'
              ? `추가 파서 준비 항목: ${smartGrowSummary.pendingParsers.join(', ')}`
              : `Pending parser setup: ${smartGrowSummary.pendingParsers.join(', ')}`
          )
        : null
    : null;

  const heroSummary = aiDisplay?.summary
    ?? aiModelRuntime?.summary
    ?? smartGrowHeroSummary
    ?? heroCopy.fallbackSummary;

  const heroImportantIssue = aiDisplay?.risks?.[0]
    ?? runtimeViolations[0]?.message
    ?? (telemetry.status === 'offline' ? heroCopy.telemetryOffline : null)
    ?? ((telemetry.status === 'stale' || telemetry.status === 'delayed') ? heroCopy.telemetryStale : null);

  const heroActions = Array.from(new Set([
    ...(aiDisplay?.actions_now ?? []),
    optimizerEnabled ? heroCopy.jumpRtr : null,
    smartGrowSummary?.nutrientCorrectionReady ? heroCopy.jumpAdvisor : null,
    heroCopy.jumpKnowledge,
  ].filter((value): value is string => Boolean(value)))).slice(0, 3);

  const alertItems: AlertRailItem[] = [
    ...(telemetry.status === 'offline'
      ? [{
          id: 'telemetry-offline',
          severity: 'critical' as const,
          title: locale === 'ko' ? '텔레메트리 연결 끊김' : 'Telemetry offline',
          body: heroCopy.telemetryOffline,
        }]
      : telemetry.status === 'stale' || telemetry.status === 'delayed'
        ? [{
            id: 'telemetry-stale',
            severity: 'warning' as const,
            title: locale === 'ko' ? '센서 갱신 지연' : 'Telemetry delayed',
            body: heroCopy.telemetryStale,
          }]
        : []),
    ...runtimeViolations.slice(0, 2).map((violation, index) => ({
      id: `runtime-${violation.code ?? index}`,
      severity: violation.severity === 'critical' ? 'critical' as const : 'warning' as const,
      title: violation.control ? `${violation.control} · ${violation.code}` : violation.code,
      body: violation.message,
    })),
    ...(aiDisplay?.risks ?? []).slice(0, 2).map((risk, index) => ({
      id: `risk-${index}`,
      severity: 'warning' as const,
      title: locale === 'ko' ? '운영 리스크' : 'Operational risk',
      body: risk,
    })),
  ];

  const commandTray = (
    <DashboardCard
      variant="narrative"
      eyebrow={heroCopy.commandTrayTitle}
      title={selectedCropLabel}
      description={heroCopy.commandTrayDescription}
      className="bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(239,244,255,0.88))]"
      actions={(
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[color:var(--sg-accent-violet-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--sg-accent-violet)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            {heroCopy.confidenceLead} {typeof aiDisplay?.confidence === 'number' ? `${Math.round(aiDisplay.confidence * 100)}%` : '-'}
          </span>
          <span className="rounded-full bg-[color:var(--sg-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            {heroCopy.freshnessLead} {telemetryDetail ?? kpiStatusSummary}
          </span>
        </div>
      )}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div className="rounded-[28px] bg-[linear-gradient(135deg,var(--sg-accent-forest),#295c47)] px-5 py-5 text-white" style={{ boxShadow: 'var(--sg-shadow-soft)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{heroCopy.workingModeLead}</div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{runtimeRecommendedAction ?? heroCopy.scenarioReady}</div>
          <p className="mt-3 text-sm leading-6 text-white/78">{heroSummary}</p>
        </div>
        {[
          { key: 'advisor', label: heroCopy.jumpAdvisor, tone: 'sg-tint-blue' },
          { key: 'rtr', label: heroCopy.jumpRtr, tone: 'sg-tint-violet' },
          { key: 'knowledge', label: heroCopy.jumpKnowledge, tone: 'sg-tint-neutral' },
          { key: 'alerts', label: heroCopy.jumpAlerts, tone: 'sg-tint-amber' },
          { key: 'resources', label: heroCopy.jumpWeather, tone: 'sg-tint-green' },
        ].map((item, index) => {
          const isActive = activeWorkspace === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveWorkspace(item.key as DashboardWorkspaceKey)}
              className={`rounded-[24px] px-4 py-4 text-left text-sm font-semibold text-[color:var(--sg-text-strong)] transition hover:-translate-y-0.5 ${item.tone} ${isActive ? 'ring-2 ring-[color:var(--sg-accent-violet)]/35' : ''}`}
              style={{ boxShadow: isActive ? 'var(--sg-shadow-soft)' : 'var(--sg-shadow-card)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">0{index + 1}</div>
                {isActive ? (
                  <span className="rounded-full bg-white/82 px-2.5 py-1 text-[10px] font-semibold text-[color:var(--sg-accent-violet)]">
                    {locale === 'ko' ? '현재' : 'Current'}
                  </span>
                ) : null}
              </div>
              <div className="mt-3">{item.label}</div>
            </button>
          );
        })}
      </div>
    </DashboardCard>
  );

  const overviewSurface = activeWorkspace === 'command'
    ? (
        <div className="space-y-6">
          <HeroControlCard
            operatingMode={runtimeRecommendedAction ?? selectedRtrProfile?.strategyLabel ?? heroCopy.scenarioReady}
            primaryNarrative={heroPrimaryNarrative}
            summary={heroSummary}
            importantIssue={heroImportantIssue}
            actions={heroActions}
            confidence={aiDisplay?.confidence ?? aiModelRuntime?.scenario?.confidence ?? null}
            telemetryStatus={telemetry.status}
            telemetryDetail={telemetryDetail}
            modelRuntimeSummary={aiModelRuntime?.summary ?? null}
            sourceSinkBalance={aiModelRuntime?.state_snapshot.source_sink_balance ?? null}
            canopyAssimilation={aiModelRuntime?.state_snapshot.canopy_net_assimilation_umol_m2_s ?? currentData.photosynthesis}
            lai={aiModelRuntime?.state_snapshot.lai ?? modelMetrics.growth.lai}
            onOpenRtr={() => setActiveWorkspace('rtr')}
            onOpenAdvisor={() => handleOpenAdvisorTabs()}
            onOpenAssistant={handleChatToggle}
          />
          <LiveMetricStrip
            statusSummary={kpiStatusSummary}
            telemetryStatus={telemetry.status}
            primaryTiles={primaryKpiTiles}
            secondaryTiles={secondaryKpiTiles}
          />
        </div>
      )
    : (
        <DashboardCard
          eyebrow={workspaceItems.find((item) => item.key === activeWorkspace)?.label}
          title={selectedCropLabel}
          description={workspaceItems.find((item) => item.key === activeWorkspace)?.description}
          className="bg-white/55"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] bg-[color:var(--sg-surface-strong)] px-4 py-4 text-sm font-semibold text-[color:var(--sg-text-strong)]">
              {heroPrimaryNarrative}
            </div>
            <div className="rounded-[22px] bg-[color:var(--sg-surface-strong)] px-4 py-4 text-sm text-[color:var(--sg-text-muted)]">
              {heroSummary}
            </div>
            <div className="rounded-[22px] bg-[color:var(--sg-surface-strong)] px-4 py-4 text-sm text-[color:var(--sg-text-muted)]">
              {telemetryDetail ?? kpiStatusSummary}
            </div>
            <div className="rounded-[22px] bg-[color:var(--sg-surface-strong)] px-4 py-4 text-sm text-[color:var(--sg-text-muted)]">
              {optimizerEnabled ? heroCopy.optimizerReady : heroCopy.optimizerBlocked}
            </div>
          </div>
        </DashboardCard>
      );

  const baseAdvisorPanel = (
    <div className="flex h-[480px] flex-col">
      <Suspense fallback={<AdvisorPanelFallback />}>
        <AiAdvisor
          analysis={aiAnalysis}
          display={aiDisplay}
          modelRuntime={aiModelRuntime}
          error={aiError}
          isLoading={isAnalyzing}
          onRefresh={handleAnalyze}
          onOpenDetails={() => handleOpenAdvisorTabs()}
          onOpenKnowledgeSearch={handleOpenRagAssistant}
          smartGrowSummary={smartGrowSummary}
          smartGrowLoading={isSmartGrowLoading}
          smartGrowError={smartGrowError}
        />
      </Suspense>
    </div>
  );

  const leftColumnSurface = activeWorkspace === 'advisor'
    ? (
        <div ref={advisorTabsAnchorRef}>
          <AdvisorTabs
            key={`${selectedCrop}-${advisorOpenRequest?.nonce ?? 0}`}
            crop={selectedCrop}
            summary={smartGrowSummary}
            currentData={currentData}
            metrics={deferredModelMetrics}
            history={deferredHistory}
            forecast={deferredForecast}
            producePrices={producePrices}
            weather={weather}
            rtrProfile={selectedRtrProfile}
            isOpen={isAdvisorTabsOpen}
            initialTab={advisorOpenRequest?.tab ?? 'environment'}
            initialCorrectionToolOpen={Boolean(advisorOpenRequest?.showCorrectionTool)}
            onClose={() => setIsAdvisorTabsOpen(false)}
          />
        </div>
      )
    : activeWorkspace === 'rtr'
      ? (
          <>
            <Suspense fallback={<LoadingSkeleton title={copy.rtrStrategy} loadingMessage={copy.rtrStrategyLoading} minHeightClassName="min-h-[320px]" />}>
              <RTROptimizerPanel
                crop={selectedCrop}
                currentData={currentData}
                history={deferredHistory}
                telemetryStatus={telemetry.status}
                temperatureSettings={controls.settings}
                weather={weather}
                loading={isWeatherLoading}
                error={weatherError}
                profile={selectedRtrProfile}
                profileLoading={isRtrProfileLoading}
                profileError={rtrProfileError}
                optimizerEnabled={optimizerEnabled}
                defaultMode={selectedRtrProfile?.optimizer?.default_mode}
                onRefreshProfiles={refreshRtrProfiles}
              />
            </Suspense>
            <DecisionSnapshotGrid
              currentData={currentData}
              modelMetrics={modelMetrics}
              weather={weather}
              weatherLoading={isWeatherLoading}
              producePrices={producePrices}
              produceLoading={isProducePricesLoading}
            />
          </>
        )
      : activeWorkspace === 'resources'
        ? (
            <>
              <Suspense fallback={<LoadingSkeleton title={copy.daeguLiveWeather} loadingMessage={copy.daeguLiveWeatherLoading} minHeightClassName="min-h-[220px]" />}>
                <WeatherOutlookPanel
                  weather={weather}
                  loading={isWeatherLoading}
                  error={weatherError}
                />
              </Suspense>
              <Suspense fallback={<LoadingSkeleton title={copy.liveProducePrices} loadingMessage={copy.liveProducePricesLoading} minHeightClassName="min-h-[420px]" />}>
                <ProducePricesPanel
                  prices={producePrices}
                  loading={isProducePricesLoading}
                  error={producePricesError}
                />
              </Suspense>
            </>
          )
        : activeWorkspace === 'alerts'
          ? (
              <>
                <AlertRail items={alertItems.length ? alertItems : [{
                  id: 'ready',
                  severity: 'resolved',
                  title: locale === 'ko' ? '현재 긴급 경보 없음' : 'No active critical alert',
                  body: heroCopy.telemetryLive,
                }]} />
                <LiveMetricStrip
                  statusSummary={kpiStatusSummary}
                  telemetryStatus={telemetry.status}
                  primaryTiles={primaryKpiTiles}
                  secondaryTiles={secondaryKpiTiles}
                />
              </>
            )
          : activeWorkspace === 'knowledge'
            ? (
                <>
                  <DashboardCard
                    eyebrow={heroCopy.knowledgeTitle}
                    title={selectedCropLabel}
                    description={heroCopy.knowledgeDescription}
                    actions={(
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleChatToggle}
                          className="rounded-full bg-[color:var(--sg-text-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--sg-accent-forest)]"
                        >
                          {heroCopy.knowledgeAssistant}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRagAssistant()}
                          className="rounded-full bg-[color:var(--sg-accent-violet)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                          {heroCopy.knowledgeRag}
                        </button>
                      </div>
                    )}
                  >
                    <p className="text-sm leading-7 text-[color:var(--sg-text-muted)]">{heroCopy.knowledgePrompt}</p>
                  </DashboardCard>
                  <Suspense fallback={<LoadingSkeleton title={copy.smartGrowSurfaceTitle} loadingMessage={copy.smartGrowSurfaceLoading} minHeightClassName="min-h-[320px]" />}>
                    <SmartGrowSurfacePanel
                      crop={selectedCrop}
                      summary={smartGrowSummary}
                      loading={isSmartGrowLoading}
                      error={smartGrowError}
                      onOpenSurface={handleOpenSmartGrowSurface}
                    />
                  </Suspense>
                </>
              )
            : (
                <>
                  <Suspense fallback={<LoadingSkeleton title={copy.rtrStrategy} loadingMessage={copy.rtrStrategyLoading} minHeightClassName="min-h-[320px]" />}>
                    <RTROptimizerPanel
                      crop={selectedCrop}
                      currentData={currentData}
                      history={deferredHistory}
                      telemetryStatus={telemetry.status}
                      temperatureSettings={controls.settings}
                      weather={weather}
                      loading={isWeatherLoading}
                      error={weatherError}
                      profile={selectedRtrProfile}
                      profileLoading={isRtrProfileLoading}
                      profileError={rtrProfileError}
                      optimizerEnabled={optimizerEnabled}
                      defaultMode={selectedRtrProfile?.optimizer?.default_mode}
                      onRefreshProfiles={refreshRtrProfiles}
                    />
                  </Suspense>
                  <CropDetails
                    crop={selectedCrop}
                    currentData={currentData}
                    metrics={modelMetrics}
                  />
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-slate-500" />
                      <h2 className="text-lg font-semibold text-slate-800">{copy.advancedModelAnalytics}: {selectedCropLabel}</h2>
                    </div>
                    <Suspense fallback={<LoadingSkeleton title={copy.advancedModelAnalytics} loadingMessage={copy.advancedModelAnalyticsLoading} minHeightClassName="min-h-[320px]" />}>
                      <ModelAnalytics
                        crop={selectedCrop}
                        metrics={deferredModelMetrics}
                        metricHistory={deferredMetricHistory}
                        forecast={deferredForecast}
                      />
                    </Suspense>
                  </div>
                  <Suspense fallback={<LoadingSkeleton title={copy.realTimeEnvironmentalAnalysis} loadingMessage={copy.realTimeEnvironmentalAnalysisLoading} minHeightClassName="min-h-[540px]" />}>
                    <Charts data={deferredHistory} />
                  </Suspense>
                </>
              );

  const rightSidebarSurface = activeWorkspace === 'resources'
    ? (
        <>
          {baseAdvisorPanel}
          <DecisionSnapshotGrid
            currentData={currentData}
            modelMetrics={modelMetrics}
            weather={weather}
            weatherLoading={isWeatherLoading}
            producePrices={producePrices}
            produceLoading={isProducePricesLoading}
          />
        </>
      )
    : activeWorkspace === 'alerts'
      ? (
          <>
            {baseAdvisorPanel}
            <Suspense fallback={<LoadingSkeleton title={copy.daeguLiveWeather} loadingMessage={copy.daeguLiveWeatherLoading} minHeightClassName="min-h-[200px]" />}>
              <WeatherOutlookPanel
                weather={weather}
                loading={isWeatherLoading}
                error={weatherError}
                compact
              />
            </Suspense>
          </>
        )
      : (
          <>
            {baseAdvisorPanel}
            {activeWorkspace !== 'knowledge' ? (
              <AlertRail items={alertItems.length ? alertItems : [{
                id: 'ready',
                severity: 'resolved',
                title: locale === 'ko' ? '현재 긴급 경보 없음' : 'No active critical alert',
                body: heroCopy.telemetryLive,
              }]} />
            ) : null}
            <Suspense fallback={<LoadingSkeleton title={copy.daeguLiveWeather} loadingMessage={copy.daeguLiveWeatherLoading} minHeightClassName="min-h-[200px]" />}>
              <WeatherOutlookPanel
                weather={weather}
                loading={isWeatherLoading}
                error={weatherError}
                compact
              />
            </Suspense>
          </>
        );

  const lowerFoldSurface = activeWorkspace === 'command'
    ? (
        <>
          <div className="mb-8">
            <Suspense fallback={<LoadingSkeleton title={copy.smartGrowSurfaceTitle} loadingMessage={copy.smartGrowSurfaceLoading} minHeightClassName="min-h-[320px]" />}>
              <SmartGrowSurfacePanel
                crop={selectedCrop}
                summary={smartGrowSummary}
                loading={isSmartGrowLoading}
                error={smartGrowError}
                onOpenSurface={handleOpenSmartGrowSurface}
              />
            </Suspense>
          </div>
          <div className="mb-8 grid gap-6 xl:grid-cols-2">
            <TodayBoard
              actionsNow={aiDisplay?.actions_now ?? []}
              actionsToday={aiDisplay?.actions_today ?? []}
              actionsWeek={aiDisplay?.actions_week ?? []}
              monitor={aiDisplay?.monitor ?? []}
            />
            <DecisionSnapshotGrid
              currentData={currentData}
              modelMetrics={modelMetrics}
              weather={weather}
              weatherLoading={isWeatherLoading}
              producePrices={producePrices}
              produceLoading={isProducePricesLoading}
            />
          </div>
          <div className="mb-8">
            <Suspense fallback={<LoadingSkeleton title={copy.liveProducePrices} loadingMessage={copy.liveProducePricesLoading} minHeightClassName="min-h-[420px]" />}>
              <ProducePricesPanel
                prices={producePrices}
                loading={isProducePricesLoading}
                error={producePricesError}
              />
            </Suspense>
          </div>
          <div className="mb-8">
            <Suspense fallback={<LoadingSkeleton title={copy.yieldForecast} loadingMessage={copy.yieldForecastLoading} minHeightClassName="min-h-[280px]" />}>
              <ForecastPanel forecast={deferredForecast} crop={selectedCrop} />
            </Suspense>
          </div>
          <div className="mb-8">
            <Suspense fallback={<LoadingSkeleton title={copy.consultingReport} loadingMessage={copy.consultingReportLoading} minHeightClassName="min-h-[320px]" />}>
              <ConsultingReport
                analysis={aiAnalysis}
                metrics={deferredModelMetrics}
                currentData={currentData}
                crop={selectedCrop}
              />
            </Suspense>
          </div>
        </>
      )
    : null;

  const bottomRowSurface = activeWorkspace === 'command' || activeWorkspace === 'crop'
    ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ControlPanel
              status={controls}
              onToggle={toggleControl}
              onSettingsChange={setTempSettings}
            />
          </div>
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Leaf className="h-4 w-4 text-green-600" />
                  {copy.cropStatus}: {selectedCropLabel}
                </h4>
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                  {getDevelopmentStageLabel(modelMetrics.growth.developmentStage, locale)}
                </span>
              </div>
              <div className="mb-1 h-2.5 w-full rounded-full bg-slate-100">
                <div className="h-2.5 rounded-full bg-green-600" style={{ width: '75%' }} />
              </div>
              <p className="flex justify-between text-xs text-slate-500">
                <span>{copy.growthCycle}</span>
                <span>
                  {growthDay ? (locale === 'ko' ? `${growthDay}일차` : `Day ${growthDay}`) : '-'}
                  {startDateLabel ? ` (${copy.since} ${startDateLabel})` : ''}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{copy.simTime}: {currentDateLabel}</p>
            </div>
          </div>
        </div>
      )
    : null;

  return (
    <AppShell
      header={(
        <TopBar
          locale={locale}
          selectedCrop={selectedCrop}
          telemetryStatus={telemetry.status}
          telemetryDetail={telemetryDetail}
          onLocaleChange={setLocale}
          onCropChange={setSelectedCrop}
          onAssistantToggle={handleChatToggle}
          assistantOpen={isChatOpen}
          getCropLabel={getCropLabel}
        />
      )}
      sidebar={(
        <WorkspaceNav
          items={workspaceItems}
          activeWorkspace={activeWorkspace}
          onSelect={setActiveWorkspace}
        />
      )}
      commandTray={commandTray}
    >
      <MainDashboard
        overview={overviewSurface}
        leftColumn={leftColumnSurface}
        rightSidebar={rightSidebarSurface}
        lowerFold={lowerFoldSurface}
        bottomRow={bottomRowSurface}
      />

      {shouldRenderChat ? (
        <Suspense
          fallback={(
            <OverlayDrawerFallback
              title={CHAT_ASSISTANT_FALLBACK_COPY[locale].title}
              closeLabel={CHAT_ASSISTANT_FALLBACK_COPY[locale].close}
              loadingLabel={CHAT_ASSISTANT_FALLBACK_COPY[locale].loading}
              onClose={() => setIsChatOpen(false)}
              variant="chat"
            />
          )}
        >
          <ChatAssistant
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            currentData={currentData}
            metrics={deferredModelMetrics}
            crop={selectedCrop}
            forecast={deferredForecast}
            history={deferredHistory}
            producePrices={producePrices}
            weather={weather}
            rtrProfile={selectedRtrProfile}
            smartGrowSummary={smartGrowSummary}
            smartGrowLoading={isSmartGrowLoading}
            smartGrowError={smartGrowError}
            onOpenKnowledgeSearch={handleOpenRagAssistant}
          />
        </Suspense>
      ) : null}
      {shouldRenderRagAssistant ? (
        <Suspense
          fallback={
            <OverlayDrawerFallback
              title={RAG_ASSISTANT_FALLBACK_COPY[locale].title}
              closeLabel={RAG_ASSISTANT_FALLBACK_COPY[locale].close}
              loadingLabel={RAG_ASSISTANT_FALLBACK_COPY[locale].loading}
              onClose={() => setIsRagAssistantOpen(false)}
              stacked={isChatOpen}
              variant="rag"
            />
          }
        >
          <RagAssistantDrawer
            key={`${selectedCrop}-${ragAssistantRequest?.nonce ?? 0}`}
            isOpen={isRagAssistantOpen}
            onClose={() => setIsRagAssistantOpen(false)}
            crop={selectedCrop}
            stacked={isChatOpen}
            request={ragAssistantRequest}
          />
          </Suspense>
        ) : null}
    </AppShell>
  );
}

export default App;
