import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { Thermometer, Droplets, CloudFog, Sun, Activity, Leaf } from 'lucide-react';
import AdvisorTabs from './components/advisor/AdvisorTabs';
import ControlPanel from './components/ControlPanel';
import CropDetails from './components/CropDetails';
import AdvisorPanelFallback from './features/advisor/AdvisorPanelFallback';
import LoadingSkeleton from './features/common/LoadingSkeleton';
import OverviewStrip from './features/overview/OverviewStrip';
import OverlayDrawerFallback from './features/chat/OverlayDrawerFallback';
import { useGreenhouse } from './hooks/useGreenhouse';
import { useAiAssistant } from './hooks/useAiAssistant';
import { useProducePrices } from './hooks/useProducePrices';
import { useRtrProfiles } from './hooks/useRtrProfiles';
import { useSmartGrowKnowledge } from './hooks/useSmartGrowKnowledge';
import { useWeatherOutlook } from './hooks/useWeatherOutlook';
import AppShell from './layout/AppShell';
import DashboardHeader from './layout/DashboardHeader';
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
const RTROutlookPanel = lazy(() => import('./components/RTROutlookPanel'));

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
    smartGrowSurfaceTitle: 'SmartGrow Advisory Surface',
    advancedModelAnalyticsLoading: 'Advanced Model Analytics module loading...',
    yieldForecastLoading: 'Yield Forecast module loading...',
    consultingReportLoading: 'Consulting Report module loading...',
    smartGrowSurfaceLoading: 'Loading SmartGrow advisory surface...',
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
    smartGrowSurfaceTitle: '스마트그로우 권장 구성',
    advancedModelAnalyticsLoading: '고급 모델 분석 모듈을 불러오는 중...',
    yieldForecastLoading: '수확 전망 모듈을 불러오는 중...',
    consultingReportLoading: '컨설팅 리포트 모듈을 불러오는 중...',
    smartGrowSurfaceLoading: '스마트그로우 권장 구성 모듈을 불러오는 중...',
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
  const [isAdvisorTabsOpen, setIsAdvisorTabsOpen] = useState(true);
  const [telemetryClock, setTelemetryClock] = useState(() => Date.now());
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

  const buildTrendDetail = (trendSummary: SensorTrendSummary, unit: string, digits = 1) => {
    const delta = formatSignedMetric(trendSummary.delta1h, digits);
    const slope = formatSignedMetric(trendSummary.slope6h, digits);
    const parts = [
      delta ? `${copy.sensorDelta} ${delta} ${unit}` : null,
      slope ? `${copy.sensorSlope} ${slope} ${unit}/h` : null,
    ].filter((value): value is string => Boolean(value));

    return parts.join(' · ');
  };

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
  const buildFieldAgeLabel = (fieldKey: SensorFieldKey): string | null =>
    formatLastCollectedAt(sensorFieldTimestamps[fieldKey], telemetryClock, locale);
  const buildKpiValue = (fieldKey: SensorFieldKey, value: number) => {
    const state = resolveSensorDisplayState(fieldKey, telemetry.status, sensorFieldAvailability);
    return state === 'missing' ? unresolvedSensorValue : value;
  };

  const primaryKpiTiles: KpiTileData[] = [
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
  ];

  const secondaryKpiTiles: KpiTileData[] = [
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
  ];
  const telemetryHeaderTone = telemetry.status === 'live'
    ? 'bg-emerald-500'
    : telemetry.status === 'delayed'
      ? 'bg-amber-500'
      : telemetry.status === 'stale'
        ? 'bg-orange-500'
        : telemetry.status === 'offline'
          ? 'bg-rose-500'
          : 'bg-slate-400 animate-pulse';
  const telemetryHeaderLabel = telemetry.status === 'live'
    ? copy.sensorLive
    : telemetry.status === 'delayed'
      ? copy.sensorDelayed
      : telemetry.status === 'stale'
        ? copy.sensorStale
        : telemetry.status === 'offline'
          ? copy.sensorOffline
          : copy.sensorLoading;

  const handleChatToggle = () => {
    if (!shouldRenderChat) {
      setShouldRenderChat(true);
    }
    setIsChatOpen((prev) => !prev);
  };

  const handleOpenRagAssistant = () => {
    if (!shouldRenderRagAssistant) {
      setShouldRenderRagAssistant(true);
    }
    setIsRagAssistantOpen(true);
  };

  const handleOpenAdvisorTabs = () => {
    setIsAdvisorTabsOpen(true);
    requestAnimationFrame(() => {
      advisorTabsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

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

  return (
    <AppShell
      header={(
        <DashboardHeader
          brandTagline={copy.brandTagline}
          languageLabel={copy.language}
          systemOnlineLabel={copy.systemOnline}
          assistantLabel={copy.askAiAssistant}
          locale={locale}
          selectedCrop={selectedCrop}
          telemetryToneClass={telemetryHeaderTone}
          telemetryLabel={telemetryHeaderLabel}
          isChatOpen={isChatOpen}
          onLocaleChange={setLocale}
          onCropChange={setSelectedCrop}
          onAssistantToggle={handleChatToggle}
          getCropLabel={getCropLabel}
        />
      )}
    >
      <MainDashboard
        overview={(
          <OverviewStrip
            statusSummary={kpiStatusSummary}
            telemetryStatus={telemetry.status}
            primaryTiles={primaryKpiTiles}
            secondaryTiles={secondaryKpiTiles}
          />
        )}
        leftColumn={(
          <>
            <CropDetails
              crop={selectedCrop}
              currentData={currentData}
              metrics={modelMetrics}
            />

            <div>
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-800">{copy.advancedModelAnalytics}: {getCropLabel(selectedCrop, locale)}</h2>
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
        )}
        rightSidebar={(
          <>
            <div className="flex h-[480px] flex-col">
              <Suspense fallback={<AdvisorPanelFallback />}>
                <AiAdvisor
                  analysis={aiAnalysis}
                  display={aiDisplay}
                  modelRuntime={aiModelRuntime}
                  isLoading={isAnalyzing}
                  onRefresh={handleAnalyze}
                  onOpenDetails={handleOpenAdvisorTabs}
                  onOpenKnowledgeSearch={handleOpenRagAssistant}
                  smartGrowSummary={smartGrowSummary}
                  smartGrowLoading={isSmartGrowLoading}
                  smartGrowError={smartGrowError}
                />
              </Suspense>
            </div>

            <Suspense fallback={<LoadingSkeleton title={copy.daeguLiveWeather} loadingMessage={copy.daeguLiveWeatherLoading} minHeightClassName="min-h-[200px]" />}>
              <WeatherOutlookPanel
                weather={weather}
                loading={isWeatherLoading}
                error={weatherError}
                compact
              />
            </Suspense>

            <Suspense fallback={<LoadingSkeleton title={copy.rtrStrategy} loadingMessage={copy.rtrStrategyLoading} minHeightClassName="min-h-[200px]" />}>
              <RTROutlookPanel
                crop={selectedCrop}
                currentData={currentData}
                history={deferredHistory}
                temperatureSettings={controls.settings}
                weather={weather}
                loading={isWeatherLoading}
                error={weatherError}
                profile={rtrProfilesPayload?.profiles[selectedCrop] ?? null}
                profileLoading={isRtrProfileLoading}
                profileError={rtrProfileError}
                compact
              />
            </Suspense>
          </>
        )}
        lowerFold={(
          <>
            <div className="mb-8">
              <Suspense fallback={<LoadingSkeleton title={copy.smartGrowSurfaceTitle} loadingMessage={copy.smartGrowSurfaceLoading} minHeightClassName="min-h-[320px]" />}>
                <SmartGrowSurfacePanel
                  crop={selectedCrop}
                  summary={smartGrowSummary}
                  loading={isSmartGrowLoading}
                  error={smartGrowError}
                />
              </Suspense>
            </div>

            <div ref={advisorTabsAnchorRef} className="mb-8">
              <AdvisorTabs
                key={selectedCrop}
                crop={selectedCrop}
                summary={smartGrowSummary}
                currentData={currentData}
                metrics={deferredModelMetrics}
                history={deferredHistory}
                forecast={deferredForecast}
                producePrices={producePrices}
                weather={weather}
                rtrProfile={rtrProfilesPayload?.profiles[selectedCrop] ?? null}
                isOpen={isAdvisorTabsOpen}
                onClose={() => setIsAdvisorTabsOpen(false)}
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
        )}
        bottomRow={(
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
                    {copy.cropStatus}: {getCropLabel(selectedCrop, locale)}
                  </h4>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    {getDevelopmentStageLabel(modelMetrics.growth.developmentStage, locale)}
                  </span>
                </div>
                <div className="mb-1 h-2.5 w-full rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-green-600" style={{ width: '75%' }}></div>
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
        )}
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
            rtrProfile={rtrProfilesPayload?.profiles[selectedCrop] ?? null}
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
            key={`${selectedCrop}-rag-assistant`}
            isOpen={isRagAssistantOpen}
            onClose={() => setIsRagAssistantOpen(false)}
            crop={selectedCrop}
            stacked={isChatOpen}
          />
        </Suspense>
      ) : null}
    </AppShell>
  );
}

export default App;
