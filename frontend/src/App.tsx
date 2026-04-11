import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Thermometer,
  Droplets,
  CloudFog,
  Sun,
  Activity,
  Leaf,
} from 'lucide-react';
import type { AlertRailItem } from './components/dashboard/AlertRail';
import type {
  RTROptimizerCustomScenarioDraft,
  RTROptimizerUiStateLike,
} from './components/RTROptimizerPanel';
import TopBar from './components/shell/TopBar';
import WorkspaceNav, { type WorkspaceNavItem } from './components/shell/WorkspaceNav';
import type { PromptAdvisorTabKey } from './components/advisor/advisorTabRegistry';
import type { RagAssistantOpenRequest } from './components/chat/ragAssistantTypes';
import AssistantDrawer from './features/assistant/AssistantDrawer';
import AssistantFab from './features/assistant/AssistantFab';
import { useAreaUnit } from './context/AreaUnitContext';
import { useGreenhouse } from './hooks/useGreenhouse';
import { useAiAssistant } from './hooks/useAiAssistant';
import { useProducePrices } from './hooks/useProducePrices';
import { useRtrOptimizer } from './hooks/useRtrOptimizer';
import { useRtrProfiles } from './hooks/useRtrProfiles';
import { useOverviewSignalTrends } from './hooks/useOverviewSignalTrends';
import { useSmartGrowKnowledge } from './hooks/useSmartGrowKnowledge';
import { useWeatherOutlook } from './hooks/useWeatherOutlook';
import AppShell from './layout/AppShell';
import type { CropType, SensorData, SensorFieldAvailability, SensorFieldKey, SensorFieldState, TelemetryStatus } from './types';
import type { AppLocale } from './i18n/locale';
import { useLocale } from './i18n/LocaleProvider';
import { formatLocaleTime } from './i18n/locale';
import { buildPrimaryRoutes, getPrimaryRouteMeta, getPrimaryRouteKey } from './app/route-meta';
import {
  buildPhytoSections,
  findPhytoSection,
  getSectionPathForAdvisorTab,
} from './routes/phytosyncSections';
import {
  getCropLabel,
  getDashboardSensorCopy,
  NUMERIC_IDEAL_RANGES,
} from './utils/displayCopy';
import { deriveSourceSinkBalance } from './utils/derivedRuntimeMetrics';
import { localizeSmartGrowSurfaceNames } from './utils/smartGrowSurfaceNames';
import type { KpiTileData } from './components/KpiStrip';
import {
  buildDataStateSummary,
  buildStatusSummary,
  deriveSensorFieldState,
  deriveSensorStatus,
  getSensorFieldStateLabel,
} from './utils/sensorStatus';

const APP_COPY = {
  en: {
    sensorReceiving: 'Receiving data',
    sensorUnavailable: 'No live data',
    sensorDelta: '1h Δ',
    sensorSlope: '6h slope',
  },
  ko: {
    sensorReceiving: '데이터 수신 중',
    sensorUnavailable: '실시간 데이터 없음',
    sensorDelta: '1h 변화',
    sensorSlope: '6h 기울기',
  },
} as const;

const AUTO_ANALYSIS_INTERVAL_MS = 30 * 60 * 1000;
type SensorMetricKey = 'temperature' | 'humidity' | 'co2' | 'light' | 'vpd' | 'stomatalConductance';
type AssistantPanelId = 'assistant-chat' | 'assistant-search' | 'assistant-history';
type RagAssistantLaunchRequest = Omit<RagAssistantOpenRequest, 'nonce'>;
type AssistantChatOpenRequest = {
  nonce: number;
  query: string;
};

type RtrUiStateSnapshot = {
  customScenarioDraft: RTROptimizerCustomScenarioDraft;
  targetNodeInputValue: string;
  isTargetNodeInputActive: boolean;
};

const RTR_UI_STATE_STORAGE_KEY = 'smartgrow-rtr-ui-state-v1';

const AssistantRoutePage = lazy(() => import('./pages/assistant-route-page'));
const AlertsRoutePage = lazy(() => import('./pages/alerts-route-page'));
const ControlRoutePage = lazy(() => import('./pages/control-route-page'));
const CropWorkRoutePage = lazy(() => import('./pages/crop-work-route-page'));
const OverviewRoutePage = lazy(() => import('./pages/overview-route-page'));
const ResourcesRoutePage = lazy(() => import('./pages/resources-route-page'));
const SettingsRoutePage = lazy(() => import('./pages/settings-route-page'));
const TrendRoutePage = lazy(() => import('./pages/trend-route-page'));

function createEmptyRtrCustomScenarioDraft(): RTROptimizerCustomScenarioDraft {
  return {
    label: '',
    dayHeatingMinTempC: '',
    nightHeatingMinTempC: '',
    dayCoolingTargetC: '',
    nightCoolingTargetC: '',
    ventBiasC: '',
    screenBiasPct: '',
    circulationFanPct: '',
    co2TargetPpm: '',
  };
}

function createEmptyRtrUiState(): RtrUiStateSnapshot {
  return {
    customScenarioDraft: createEmptyRtrCustomScenarioDraft(),
    targetNodeInputValue: '',
    isTargetNodeInputActive: false,
  };
}

function createInitialRtrUiStateByCrop(): Record<CropType, RtrUiStateSnapshot> {
  return {
    Tomato: createEmptyRtrUiState(),
    Cucumber: createEmptyRtrUiState(),
  };
}

function isRtrUiStateSnapshot(value: unknown): value is RtrUiStateSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<RtrUiStateSnapshot>;
  return (
    typeof candidate.targetNodeInputValue === 'string'
    && typeof candidate.isTargetNodeInputActive === 'boolean'
    && !!candidate.customScenarioDraft
    && typeof candidate.customScenarioDraft === 'object'
  );
}

function resolveInitialRtrUiStateByCrop(): Record<CropType, RtrUiStateSnapshot> {
  if (typeof window === 'undefined') {
    return createInitialRtrUiStateByCrop();
  }

  try {
    const raw = window.localStorage.getItem(RTR_UI_STATE_STORAGE_KEY);
    if (!raw) {
      return createInitialRtrUiStateByCrop();
    }
    const parsed = JSON.parse(raw) as Partial<Record<CropType, RtrUiStateSnapshot>>;
    const defaults = createInitialRtrUiStateByCrop();
    return {
      Tomato: isRtrUiStateSnapshot(parsed.Tomato) ? parsed.Tomato : defaults.Tomato,
      Cucumber: isRtrUiStateSnapshot(parsed.Cucumber) ? parsed.Cucumber : defaults.Cucumber,
    };
  } catch {
    return createInitialRtrUiStateByCrop();
  }
}

function RouteLoadingFallback() {
  return (
    <div className="rounded-[24px] border border-[rgba(34,34,34,0.08)] bg-white px-6 py-8 text-sm font-medium text-[var(--ink-500)] shadow-[0_20px_60px_rgba(34,34,34,0.06)]">
      화면을 불러오는 중입니다.
    </div>
  );
}

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

function normalizeAssistantPanelId(panelId: string | null | undefined): AssistantPanelId | null {
  switch (panelId) {
    case 'ask-chat':
    case 'assistant-chat':
      return 'assistant-chat';
    case 'ask-search':
    case 'assistant-search':
      return 'assistant-search';
    case 'ask-history':
    case 'assistant-history':
      return 'assistant-search';
    default:
      return null;
  }
}

function resolveSensorDisplayState(
  fieldKey: SensorFieldKey,
  telemetryStatus: TelemetryStatus,
  availability: SensorFieldAvailability,
): SensorFieldState {
  return deriveSensorFieldState(availability[fieldKey], telemetryStatus);
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, setLocale } = useLocale();
  const { areaByCrop } = useAreaUnit();
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
    setTempSettings
  } = useGreenhouse();

  const {
    aiAnalysis,
    aiDisplay,
    aiModelRuntime,
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
    signals: overviewSignals,
    loading: overviewSignalsLoading,
    error: overviewSignalsError,
  } = useOverviewSignalTrends(selectedCrop);
  const {
    summary: smartGrowSummary,
    loading: isSmartGrowLoading,
    error: smartGrowError,
  } = useSmartGrowKnowledge(selectedCrop);

  const [assistantSearchRequest, setAssistantSearchRequest] = useState<RagAssistantOpenRequest | null>(null);
  const [assistantChatRequest, setAssistantChatRequest] = useState<AssistantChatOpenRequest | null>(null);
  const [assistantDrawerOpen, setAssistantDrawerOpen] = useState(false);
  const [assistantDrawerPanel, setAssistantDrawerPanel] = useState<AssistantPanelId>('assistant-chat');
  const [telemetryClock, setTelemetryClock] = useState(() => Date.now());
  const [sectionTabSelections, setSectionTabSelections] = useState<Record<string, string>>({});
  const lastAutoAnalysisRef = useRef<Record<CropType, { telemetryTimestamp: number; marketFetchedAt: string | null }>>({
    Tomato: { telemetryTimestamp: 0, marketFetchedAt: null },
    Cucumber: { telemetryTimestamp: 0, marketFetchedAt: null },
  });
  const deferredHistory = useDeferredValue(history);
  const deferredForecast = useDeferredValue(forecast);
  const deferredModelMetrics = useDeferredValue(modelMetrics);
  const primaryRoutes = useMemo(() => buildPrimaryRoutes(locale), [locale]);
  const activePrimaryRouteKey = useMemo(() => getPrimaryRouteKey(location.pathname), [location.pathname]);
  const activePrimaryRoute = useMemo(
    () => getPrimaryRouteMeta(location.pathname, locale),
    [location.pathname, locale],
  );
  const sections = useMemo(() => buildPhytoSections(locale), [locale]);
  const activeSection = useMemo(
    () => findPhytoSection(sections, location.pathname),
    [location.pathname, sections],
  );
  const isAssistantRoute = location.pathname.startsWith('/assistant') || location.pathname.startsWith('/ask');
  const assistantSection = useMemo(
    () => sections.find((section) => section.key === 'assistant') ?? sections[0],
    [sections],
  );
  const routeHashTabId = activeSection.key === 'assistant'
    ? normalizeAssistantPanelId(location.hash.replace(/^#/, ''))
    : location.hash.replace(/^#/, '') || null;
  const normalizedRouteHashTabId = activeSection.key === 'control' && routeHashTabId === 'control-action'
    ? 'control-strategy'
    : routeHashTabId;
  const routeSectionTabId = activeSection.tabs.find((tab) => tab.id === normalizedRouteHashTabId)?.id;
  const activeSectionTabId = routeSectionTabId ?? sectionTabSelections[activeSection.key] ?? activeSection.tabs[0]?.id;
  const activePanelId = activeSectionTabId ?? activeSection.tabs[0]?.id ?? '';
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
      color: 'bg-[color:var(--sg-accent-harvest)]',
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
      color: 'bg-[color:var(--sg-accent-earth)]',
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
  const [rtrUiStateByCrop, setRtrUiStateByCrop] = useState<Record<CropType, RtrUiStateSnapshot>>(
    () => resolveInitialRtrUiStateByCrop(),
  );
  const tomatoRtrProfile = rtrProfilesPayload?.profiles.Tomato ?? null;
  const cucumberRtrProfile = rtrProfilesPayload?.profiles.Cucumber ?? null;
  const tomatoOptimizerEnabled =
    tomatoRtrProfile?.optimizer?.enabled
    ?? rtrProfilesPayload?.optimizerEnabled
    ?? false;
  const cucumberOptimizerEnabled =
    cucumberRtrProfile?.optimizer?.enabled
    ?? rtrProfilesPayload?.optimizerEnabled
    ?? false;
  const selectedCropLabel = getCropLabel(selectedCrop, locale);
  const selectedRtrProfile = selectedCrop === 'Tomato' ? tomatoRtrProfile : cucumberRtrProfile;
  const optimizerEnabled = selectedCrop === 'Tomato' ? tomatoOptimizerEnabled : cucumberOptimizerEnabled;
  const selectedAreaState = areaByCrop[selectedCrop];
  const rtrOptimizerRouteActive = activeSection.key === 'control';
  const rtrOptimizerState = useRtrOptimizer({
    crop: selectedCrop,
    actualAreaM2: selectedAreaState.actualAreaM2,
    actualAreaPyeong: selectedAreaState.actualAreaPyeong,
    actualAreaSource: selectedAreaState.source,
    optimizerEnabled,
    defaultMode: selectedRtrProfile?.optimizer?.default_mode,
    telemetryStatus: telemetry.status,
    active: rtrOptimizerRouteActive,
    autoRunSupplemental: false,
  });
  const selectedRtrUiState = rtrUiStateByCrop[selectedCrop];
  const updateSelectedRtrUiState = useCallback(
    (updater: (current: RtrUiStateSnapshot) => RtrUiStateSnapshot) => {
      setRtrUiStateByCrop((current) => ({
        ...current,
        [selectedCrop]: updater(current[selectedCrop]),
      }));
    },
    [selectedCrop],
  );
  const rtrOptimizerUiState = useMemo<RTROptimizerUiStateLike>(() => ({
    customScenarioDraft: selectedRtrUiState.customScenarioDraft,
    setCustomScenarioDraft: (value) => {
      updateSelectedRtrUiState((current) => ({
        ...current,
        customScenarioDraft: typeof value === 'function'
          ? value(current.customScenarioDraft)
          : value,
      }));
    },
    targetNodeInputValue: selectedRtrUiState.targetNodeInputValue,
    setTargetNodeInputValue: (value) => {
      updateSelectedRtrUiState((current) => ({
        ...current,
        targetNodeInputValue: typeof value === 'function'
          ? value(current.targetNodeInputValue)
          : value,
      }));
    },
    isTargetNodeInputActive: selectedRtrUiState.isTargetNodeInputActive,
    setIsTargetNodeInputActive: (value) => {
      updateSelectedRtrUiState((current) => ({
        ...current,
        isTargetNodeInputActive: typeof value === 'function'
          ? value(current.isTargetNodeInputActive)
          : value,
      }));
    },
  }), [selectedRtrUiState, updateSelectedRtrUiState]);
  useEffect(() => {
    try {
      window.localStorage.setItem(RTR_UI_STATE_STORAGE_KEY, JSON.stringify(rtrUiStateByCrop));
    } catch {
      // Ignore storage failures for local draft persistence.
    }
  }, [rtrUiStateByCrop]);
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
        telemetryStale: '센서 갱신이 지연되어 추천안은 보수적으로 보는 것이 좋습니다.',
        telemetryOffline: '실시간 텔레메트리가 끊겨 수동 확인이 필요합니다.',
        optimizerReady: '온실 환경 비교안과 추천 온도를 바로 비교할 수 있습니다.',
        optimizerBlocked: '추천 제어안은 평소 설정 비교로만 보여줍니다.',
        commandTrayTitle: '오늘 운영 방향',
        commandTrayDescription: '오늘 바로 열어야 할 워크스페이스와 핵심 운영 포인트를 정리했습니다.',
        jumpAdvisor: '생육과 작업 보기',
        jumpRtr: '온실 환경 보기',
        jumpKnowledge: '자료 찾기',
        jumpAlerts: '알림 점검',
        jumpWeather: '날씨와 자원',
        commandCenter: '오늘 한눈에',
        advisor: '재배 도움',
        rtr: '온실 환경',
        crop: '생육 · 작업',
        resources: '자원 · 비용',
        alerts: '긴급 알림',
        knowledge: '자료 찾기 · 질문',
        commandDesc: '오늘 상태, 추천 행동, 핵심 제어',
        advisorDesc: '생육, 작업, 양액, 방제 판단',
        rtrDesc: '냉난방, 환기, 스크린, 비교안',
        cropDesc: '생육, 작업, 수확 추세',
        resourcesDesc: '에너지, 물, 가격, 비용',
        alertsDesc: '위험, 차단 요인, 조치 로그',
        knowledgeDesc: '자료 찾기와 질문 흐름',
        alertsWorkspaceTitle: '긴급 알림 및 운영 확인',
        alertsWorkspaceDescription: '센서 상태, 제약 위반, 운영 리스크를 한곳에서 점검합니다.',
        resourcesTitle: '자원 및 비용',
        resourcesDescription: '날씨, 가격, 에너지, 자원 흐름을 운영 의사결정과 연결합니다.',
        knowledgeTitle: '자료 찾기 · 질문',
        knowledgeDescription: '찾아보고 묻는 흐름을 한곳에 모읍니다.',
        knowledgePrompt: '막히는 판단은 자료를 먼저 찾고, 바로 질문으로 이어가세요.',
        knowledgeAssistant: '질문하기',
        knowledgeRag: '자료 찾기',
        confidenceLead: '반영 상태',
        freshnessLead: '센서 상태',
        workingModeLead: '현재 운영 모드',
        scenarioReady: '시나리오 비교 가능',
        cropSnapshot: '생육 스냅샷',
        cropSnapshotDescription: '현재 생육 단계와 수동 제어 상태를 함께 확인합니다.',
        telemetryLive: '실시간 데이터가 정상 수신 중입니다.',
      }
      : {
        fallbackSummary: 'The command center organizes today’s operating actions and model-backed guidance in one canvas.',
        telemetryStale: 'Telemetry is delayed, so review the recommendation conservatively.',
        telemetryOffline: 'Live telemetry is offline, so a manual greenhouse check is required.',
        optimizerReady: 'Climate-control comparisons and recommended temperatures are ready.',
        optimizerBlocked: 'Recommendations are currently limited to baseline behavior.',
        commandTrayTitle: 'Today operating focus',
        commandTrayDescription: 'Jump directly into the workspace that matters most for the next decision.',
        jumpAdvisor: 'Open growth lane',
        jumpRtr: 'Open control lane',
        jumpKnowledge: 'Search materials',
        jumpAlerts: 'Review alerts',
        jumpWeather: 'Weather and resources',
        commandCenter: 'Overview',
        advisor: 'Grower support',
        rtr: 'Climate control',
        crop: 'Crop & Work',
        resources: 'Resources',
        alerts: 'Alerts',
        knowledge: 'Materials & Ask',
        commandDesc: 'Today status, actions, and key controls',
        advisorDesc: 'Growth, work, nutrient, and protection decisions',
        rtrDesc: 'HVAC, vent, screen, and compare lanes',
        cropDesc: 'Growth, work pressure, and harvest trend',
        resourcesDesc: 'Energy, water, prices, and operating cost',
        alertsDesc: 'Risks, blockers, and response flow',
        knowledgeDesc: 'Search materials and continue into questions',
        alertsWorkspaceTitle: 'Alerts and operator checks',
        alertsWorkspaceDescription: 'Review telemetry state, control limits, and operating risks in one place.',
        resourcesTitle: 'Resources and economics',
        resourcesDescription: 'Connect weather, market, energy, and resource use to decisions.',
        knowledgeTitle: 'Materials & Ask',
        knowledgeDescription: 'Keep material search and follow-up questions in one place.',
        knowledgePrompt: 'Search materials first, then move straight into the follow-up question.',
        knowledgeAssistant: 'Ask',
        knowledgeRag: 'Search',
        confidenceLead: 'Readiness',
        freshnessLead: 'Telemetry freshness',
        workingModeLead: 'Operating mode',
        scenarioReady: 'Scenario compare ready',
        cropSnapshot: 'Crop snapshot',
        cropSnapshotDescription: 'See crop progress and manual control state together.',
        telemetryLive: 'Live telemetry is arriving on time.',
      }
  ), [locale]);

  const openAssistantDrawer = useCallback((panel: AssistantPanelId) => {
    setAssistantDrawerPanel(panel);
    setAssistantDrawerOpen(true);
  }, [setAssistantDrawerOpen, setAssistantDrawerPanel]);

  const handleChatToggle = useCallback(() => {
    if (isAssistantRoute) {
      setAssistantDrawerOpen(false);
      setAssistantDrawerPanel('assistant-chat');
      navigate({ pathname: '/assistant', hash: '#assistant-chat' });
      return;
    }
    openAssistantDrawer('assistant-chat');
  }, [isAssistantRoute, navigate, openAssistantDrawer, setAssistantDrawerOpen, setAssistantDrawerPanel]);

  const handleOpenRagAssistant = useCallback((request?: RagAssistantLaunchRequest) => {
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
    setAssistantSearchRequest({
      ...defaultRequest,
      ...request,
      nonce: Date.now(),
    });
    if (isAssistantRoute) {
      setAssistantDrawerOpen(false);
      setAssistantDrawerPanel('assistant-search');
      navigate({ pathname: '/assistant', hash: '#assistant-search' });
      return;
    }
    openAssistantDrawer('assistant-search');
  }, [
    isAssistantRoute,
    locale,
    navigate,
    openAssistantDrawer,
    selectedCropLabel,
    setAssistantDrawerOpen,
    setAssistantDrawerPanel,
    setAssistantSearchRequest,
    smartGrowSummary,
  ]);

  const handleTopBarSearchSubmit = useCallback((query: string) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return;
    }
    setAssistantChatRequest({
      nonce: Date.now(),
      query: normalizedQuery,
    });
    if (isAssistantRoute) {
      setAssistantDrawerOpen(false);
      setAssistantDrawerPanel('assistant-chat');
      navigate({ pathname: '/assistant', hash: '#assistant-chat' });
      return;
    }
    openAssistantDrawer('assistant-chat');
  }, [isAssistantRoute, navigate, openAssistantDrawer, setAssistantChatRequest, setAssistantDrawerOpen, setAssistantDrawerPanel]);

  const handleOpenSettings = useCallback(() => {
    setAssistantDrawerOpen(false);
    navigate('/settings');
  }, [navigate, setAssistantDrawerOpen]);

  const handleOpenAlerts = useCallback(() => {
    setAssistantDrawerOpen(false);
    navigate({ pathname: '/alerts', hash: '#alerts-priority' });
  }, [navigate, setAssistantDrawerOpen]);

  const handleOpenAdvisorTabs = useCallback((
    tab: PromptAdvisorTabKey = 'environment',
  ) => {
    navigate(getSectionPathForAdvisorTab(tab));
  }, [navigate]);

  const handleOpenSmartGrowSurface = useCallback((surfaceKey: 'pesticide' | 'nutrient' | 'nutrient_correction') => {
    if (surfaceKey === 'pesticide') {
      handleOpenAdvisorTabs('pesticide');
      return;
    }
    if (surfaceKey === 'nutrient_correction') {
      navigate('/resources#resources-nutrient');
      return;
    }
    handleOpenAdvisorTabs('nutrient');
  }, [handleOpenAdvisorTabs, navigate]);

  const resolveRoutePath = useCallback((key: string) => {
    switch (key) {
      case 'overview':
        return '/overview';
      case 'control':
        return '/control';
      case 'trend':
        return '/trend';
      case 'growth':
      case 'crop-work':
        return '/crop-work';
      case 'nutrient':
      case 'harvest':
      case 'resources':
        return '/resources';
      case 'protection':
      case 'alerts':
        return '/alerts';
      case 'ask':
      case 'assistant':
        return '/assistant';
      case 'settings':
        return '/settings';
      default:
        return sections.find((section) => section.key === key)?.path ?? '/overview';
    }
  }, [sections]);

  const handleWorkspaceSelect = useCallback((workspace: string) => {
    setAssistantDrawerOpen(false);
    const nextRoute = primaryRoutes.find((route) => route.key === workspace);
    navigate(nextRoute?.path ?? resolveRoutePath(workspace));
  }, [navigate, primaryRoutes, resolveRoutePath, setAssistantDrawerOpen]);

  const handleSectionTabSelect = useCallback((tabId: string) => {
    setSectionTabSelections((current) => ({ ...current, [activeSection.key]: tabId }));

    navigate({ pathname: activeSection.path, hash: `#${tabId}` }, { replace: true });
  }, [activeSection.key, activeSection.path, navigate, setSectionTabSelections]);

  const handleWorkspaceActionSelect = useCallback((workspace: string, tabId: string) => {
    const targetSection = sections.find((section) => section.key === workspace);
    if (!targetSection) {
      return;
    }

    setSectionTabSelections((current) => ({ ...current, [targetSection.key]: tabId }));

    if (workspace === 'control') {
      navigate(targetSection.path, { replace: true });
      return;
    }

    navigate({ pathname: targetSection.path, hash: `#${tabId}` }, { replace: true });
  }, [navigate, sections, setSectionTabSelections]);

  useEffect(() => {
    if (activeSection.key !== 'assistant') {
      return;
    }

    const rawHash = location.hash.replace(/^#/, '');
    const normalizedHash = normalizeAssistantPanelId(rawHash);

    if (!rawHash || !normalizedHash || normalizedHash === rawHash) {
      return;
    }

    navigate({ pathname: activeSection.path, hash: `#${normalizedHash}` }, { replace: true });
  }, [activeSection.key, activeSection.path, location.hash, navigate]);

  useEffect(() => {
    if (activeSection.key !== 'control' || routeHashTabId !== 'control-action') {
      return;
    }

    navigate({ pathname: activeSection.path, hash: '#control-strategy' }, { replace: true });
  }, [activeSection.key, activeSection.path, navigate, routeHashTabId]);

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

  const workspaceItems = useMemo<WorkspaceNavItem[]>(() => (
    primaryRoutes.map((route) => ({
      key: route.key,
      label: route.label,
      shortLabel: route.shortLabel,
      description: route.description,
      icon: route.icon,
      actions: sections.find((section) => section.key === route.key)?.tabs ?? [],
    }))
  ), [primaryRoutes, sections]);

  const heroPrimaryNarrative = runtimeRecommendedAction
    ? (locale === 'ko' ? `지금: ${runtimeRecommendedAction}` : `Now: ${runtimeRecommendedAction}`)
    : telemetry.status === 'offline'
      ? heroCopy.telemetryOffline
      : telemetry.status === 'stale' || telemetry.status === 'delayed'
        ? heroCopy.telemetryStale
        : optimizerEnabled
          ? heroCopy.optimizerReady
          : heroCopy.optimizerBlocked;

  const localizedAdvisorySurfaceNames = smartGrowSummary
    ? localizeSmartGrowSurfaceNames(smartGrowSummary.advisorySurfaceNames, locale)
    : [];

  const smartGrowHeroSummary = smartGrowSummary
    ? localizedAdvisorySurfaceNames.length > 0
      ? (
          locale === 'ko'
            ? `바로 열 수 있는 도구 ${localizedAdvisorySurfaceNames.join(', ')}를 운영 판단과 연결할 수 있습니다.`
            : `Open ${localizedAdvisorySurfaceNames.join(', ')} directly from the operating flow.`
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

  const derivedSourceSinkBalance = deriveSourceSinkBalance({
    crop: selectedCrop,
    currentData,
    metrics: modelMetrics,
  });
  const latestMetricHistoryPoint = metricHistory[metricHistory.length - 1];
  const liveSourceSinkBalance = useMemo(() => {
    const explicitBalance = latestMetricHistoryPoint?.sourceSinkBalance;
    if (typeof explicitBalance === 'number' && Number.isFinite(explicitBalance)) {
      return explicitBalance;
    }
    const sourceCapacity = latestMetricHistoryPoint?.sourceCapacity;
    const sinkDemand = latestMetricHistoryPoint?.sinkDemand;
    if (
      typeof sourceCapacity === 'number'
      && Number.isFinite(sourceCapacity)
      && typeof sinkDemand === 'number'
      && Number.isFinite(sinkDemand)
    ) {
      return (sourceCapacity - sinkDemand) / Math.max(1, Math.abs(sourceCapacity) + Math.abs(sinkDemand));
    }
    return derivedSourceSinkBalance;
  }, [derivedSourceSinkBalance, latestMetricHistoryPoint]);
  const liveSourceSinkSeries = useMemo(() => {
    const series = metricHistory
      .map((metricPoint) => {
        const wallClockTimestamp = Number(metricPoint.receivedAtTimestamp ?? metricPoint.timestamp);
        if (!Number.isFinite(wallClockTimestamp)) {
          return null;
        }

        const explicitBalance = metricPoint?.sourceSinkBalance;
        if (typeof explicitBalance === 'number' && Number.isFinite(explicitBalance)) {
          return {
            timestamp: wallClockTimestamp,
            value: explicitBalance,
          };
        }
        const sourceCapacity = metricPoint?.sourceCapacity;
        const sinkDemand = metricPoint?.sinkDemand;
        if (
          typeof sourceCapacity === 'number'
          && Number.isFinite(sourceCapacity)
          && typeof sinkDemand === 'number'
          && Number.isFinite(sinkDemand)
        ) {
          return {
            timestamp: wallClockTimestamp,
            value: (sourceCapacity - sinkDemand) / Math.max(1, Math.abs(sourceCapacity) + Math.abs(sinkDemand)),
          };
        }
        const pointMetrics = {
          ...modelMetrics,
          growth: {
            ...modelMetrics.growth,
            lai: metricPoint.lai,
            biomass: metricPoint.biomass,
            growthRate: metricPoint.growthRate,
            activeTrusses: metricPoint.activeTrusses ?? modelMetrics.growth.activeTrusses,
            nodeCount: metricPoint.nodeCount ?? modelMetrics.growth.nodeCount,
          },
          yield: {
            ...modelMetrics.yield,
            predictedWeekly: metricPoint.predictedWeeklyYield,
            harvestableFruits: metricPoint.harvestableFruits,
          },
          energy: {
            ...modelMetrics.energy,
            consumption: metricPoint.energyConsumption,
            loadKw: metricPoint.energyLoadKw,
            efficiency: metricPoint.energyEfficiency,
          },
        };

        return {
          timestamp: wallClockTimestamp,
          value: deriveSourceSinkBalance({
            crop: selectedCrop,
            currentData: {
              ...currentData,
              timestamp: metricPoint.timestamp,
              receivedAtTimestamp: wallClockTimestamp,
              photosynthesis: metricPoint.photosynthesis ?? currentData.photosynthesis,
            },
            metrics: pointMetrics,
          }),
        };
      })
      .filter((point): point is { timestamp: number; value: number } => point !== null)
      .sort((left, right) => left.timestamp - right.timestamp);

    if (series.length > 0) {
      return series;
    }

    const currentTimestamp = Number(currentData.receivedAtTimestamp ?? currentData.timestamp);
    if (!Number.isFinite(currentTimestamp)) {
      return [];
    }

    return [{
      timestamp: currentTimestamp,
      value: liveSourceSinkBalance,
    }];
  }, [currentData, liveSourceSinkBalance, metricHistory, modelMetrics, selectedCrop]);

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
  const navStatusLabel = locale === 'ko'
    ? ({
        live: '센서 정상',
        delayed: '갱신 지연',
        stale: '오래된 값',
        offline: '수동 확인 필요',
        blocked: '수동 확인 필요',
        provisional: '임시 계산',
        loading: '값 들어오는 중',
      } as const)[telemetry.status]
    : ({
        live: 'Sensors live',
        delayed: 'Update delayed',
        stale: 'Stale values',
        offline: 'Manual check needed',
        blocked: 'Manual check needed',
        provisional: 'Provisional',
        loading: 'Loading',
      } as const)[telemetry.status];

  const cropWorkPage = (
    <CropWorkRoutePage
      locale={locale}
      crop={selectedCrop}
      currentData={currentData}
      modelMetrics={deferredModelMetrics}
      forecast={deferredForecast}
      aiAnalysis={aiAnalysis}
      actionsNow={aiDisplay?.actions_now ?? []}
      actionsToday={aiDisplay?.actions_today ?? []}
      actionsWeek={aiDisplay?.actions_week ?? []}
      monitor={aiDisplay?.monitor ?? []}
      activePanel={activePanelId === 'crop-work-harvest' ? 'crop-work-harvest' : activePanelId === 'crop-work-work' ? 'crop-work-work' : 'crop-work-growth'}
    />
  );

  const resourcesPage = (
    <ResourcesRoutePage
      locale={locale}
      crop={selectedCrop}
      cropLabel={selectedCropLabel}
      currentData={currentData}
      modelMetrics={modelMetrics}
      weather={weather}
      weatherLoading={isWeatherLoading}
      weatherError={weatherError}
      producePrices={producePrices}
      produceLoading={isProducePricesLoading}
      produceError={producePricesError}
      activePanel={activePanelId === 'resources-market' ? 'resources-market' : activePanelId === 'resources-nutrient' ? 'resources-stock' : 'resources-energy'}
    />
  );

  const alertsPage = (
    <AlertsRoutePage
      locale={locale}
      items={alertItems}
      fallbackAlertBody={heroCopy.telemetryLive}
      telemetryStatus={telemetry.status}
      statusSummary={kpiStatusSummary}
      primaryTiles={primaryKpiTiles}
      secondaryTiles={secondaryKpiTiles}
      activePanel={activePanelId === 'alerts-history' ? 'alerts-history' : activePanelId === 'alerts-warning' ? 'alerts-stream' : 'alerts-priority'}
    />
  );

  const trendPage = (
    <TrendRoutePage
      locale={locale}
      crop={selectedCrop}
      currentData={currentData}
      modelMetrics={modelMetrics}
      history={deferredHistory}
      weather={weather}
      weatherLoading={isWeatherLoading}
      weatherError={weatherError}
      producePrices={producePrices}
      produceLoading={isProducePricesLoading}
      overviewSignals={overviewSignals}
    />
  );

  const assistantPage = (
    <AssistantRoutePage
      locale={locale}
      crop={selectedCrop}
      cropLabel={selectedCropLabel}
      panelTabs={assistantSection.tabs}
      onSelectPanel={handleSectionTabSelect}
      summary={smartGrowSummary}
      activePanel={activePanelId as AssistantPanelId}
      searchRequest={assistantSearchRequest}
      chatRequest={assistantChatRequest}
      currentData={currentData}
      metrics={deferredModelMetrics}
      forecast={deferredForecast}
      history={deferredHistory}
      producePrices={producePrices}
      weather={weather}
      rtrProfile={selectedRtrProfile}
      smartGrowLoading={isSmartGrowLoading}
      smartGrowError={smartGrowError}
      onOpenSearch={handleOpenRagAssistant}
      onOpenSurface={handleOpenSmartGrowSurface}
    />
  );

  const settingsPage = (
    <SettingsRoutePage
      locale={locale}
      selectedCropLabel={selectedCropLabel}
      assistantOpen={assistantDrawerOpen}
      telemetrySummary={kpiStatusSummary}
      weatherConnected={Boolean(weather)}
      marketConnected={Boolean(producePrices)}
    />
  );

  return (
    <AppShell
      header={(
        <TopBar
          locale={locale}
          selectedCrop={selectedCrop}
          telemetryStatus={telemetry.status}
          telemetryDetail={telemetryDetail}
          pageTitle={activePrimaryRoute.title}
          pageDescription={activePrimaryRoute.heroDescription}
          onLocaleChange={setLocale}
          onCropChange={setSelectedCrop}
          onAssistantToggle={handleChatToggle}
          onOpenAlerts={handleOpenAlerts}
          onSearchSubmit={handleTopBarSearchSubmit}
          onOpenSettings={handleOpenSettings}
          assistantOpen={assistantDrawerOpen}
          getCropLabel={getCropLabel}
        />
      )}
      sidebar={(
        <WorkspaceNav
          items={workspaceItems}
          activeWorkspace={activePrimaryRouteKey}
          activeActionId={activePanelId}
          statusLabel={navStatusLabel}
          onSelect={handleWorkspaceSelect}
          onSelectAction={handleWorkspaceActionSelect}
        />
      )}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route
          path="/overview"
          element={(
            <Suspense fallback={<RouteLoadingFallback />}>
              <OverviewRoutePage
                locale={locale}
                crop={selectedCrop}
                telemetryStatus={telemetry.status}
                telemetryDetail={telemetryDetail}
                primaryKpiTiles={primaryKpiTiles}
                secondaryKpiTiles={secondaryKpiTiles}
                runtimeRecommendedAction={runtimeRecommendedAction ?? selectedRtrProfile?.strategyLabel ?? heroCopy.scenarioReady}
                heroPrimaryNarrative={heroPrimaryNarrative}
                heroSummary={heroSummary}
                heroImportantIssue={heroImportantIssue}
                heroActions={heroActions}
                confidence={aiDisplay?.confidence ?? aiModelRuntime?.scenario?.confidence ?? null}
                modelRuntimeSummary={aiModelRuntime?.summary ?? null}
                sourceSinkBalance={liveSourceSinkBalance}
                canopyAssimilation={currentData.photosynthesis}
                lai={modelMetrics.growth.lai}
                liveSourceSinkSeries={liveSourceSinkSeries}
                alertItems={alertItems}
                fallbackAlertBody={heroCopy.telemetryLive}
                history={deferredHistory}
                currentData={currentData}
                modelMetrics={modelMetrics}
                overviewSignals={overviewSignals}
                overviewSignalsLoading={overviewSignalsLoading}
                overviewSignalsError={overviewSignalsError}
                weather={weather}
                weatherLoading={isWeatherLoading}
                producePrices={producePrices}
                produceLoading={isProducePricesLoading}
                actionsNow={aiDisplay?.actions_now ?? []}
                actionsToday={aiDisplay?.actions_today ?? []}
                actionsWeek={aiDisplay?.actions_week ?? []}
                monitor={aiDisplay?.monitor ?? []}
                rtrProfile={selectedRtrProfile}
                activeTabId={activePanelId}
                onOpenRtr={() => navigate('/control#control-strategy')}
                onOpenAdvisor={() => handleOpenAdvisorTabs('environment')}
                onOpenAssistant={handleChatToggle}
              />
            </Suspense>
          )}
        />
        <Route
          path="/control"
          element={(
            <Suspense fallback={<RouteLoadingFallback />}>
              <ControlRoutePage
                locale={locale}
                activePanel={activePanelId === 'control-devices'
                  ? 'control-devices'
                  : 'control-strategy'}
                crop={selectedCrop}
                controls={controls}
                onToggle={toggleControl}
                onSettingsChange={setTempSettings}
                alertItems={alertItems}
                fallbackAlertBody={heroCopy.telemetryLive}
                history={deferredHistory}
                currentData={currentData}
                weather={weather}
                weatherLoading={isWeatherLoading}
                weatherError={weatherError}
                temperatureSettings={controls.settings}
                profile={selectedRtrProfile}
                profileLoading={isRtrProfileLoading}
                profileError={rtrProfileError}
                optimizerEnabled={optimizerEnabled}
                defaultMode={selectedRtrProfile?.optimizer?.default_mode}
                onRefreshProfiles={refreshRtrProfiles}
                optimizerState={rtrOptimizerState}
                uiState={rtrOptimizerUiState}
              />
            </Suspense>
          )}
        />
        <Route path="/rtr" element={<Navigate to={{ pathname: '/control', hash: '#control-strategy' }} replace />} />
        <Route path="/trend" element={<Suspense fallback={<RouteLoadingFallback />}>{trendPage}</Suspense>} />
        <Route path="/crop-work" element={<Suspense fallback={<RouteLoadingFallback />}>{cropWorkPage}</Suspense>} />
        <Route path="/resources" element={<Suspense fallback={<RouteLoadingFallback />}>{resourcesPage}</Suspense>} />
        <Route path="/alerts" element={<Suspense fallback={<RouteLoadingFallback />}>{alertsPage}</Suspense>} />
        <Route path="/assistant" element={<Suspense fallback={<RouteLoadingFallback />}>{assistantPage}</Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<RouteLoadingFallback />}>{settingsPage}</Suspense>} />
        <Route path="/overview/legacy" element={<Navigate to="/overview" replace />} />
        <Route path="/control/legacy" element={<Navigate to="/control" replace />} />
        <Route path="/trend/legacy" element={<Navigate to="/trend" replace />} />
        <Route path="/resources/legacy" element={<Navigate to="/resources" replace />} />
        <Route path="/alerts/legacy" element={<Navigate to="/alerts" replace />} />
        <Route path="/growth" element={<Navigate to={{ pathname: '/crop-work', hash: '#crop-work-growth' }} replace />} />
        <Route path="/nutrient" element={<Navigate to={{ pathname: '/resources', hash: '#resources-nutrient' }} replace />} />
        <Route path="/protection" element={<Navigate to={{ pathname: '/alerts', hash: '#alerts-warning' }} replace />} />
        <Route path="/harvest" element={<Navigate to={{ pathname: '/crop-work', hash: '#crop-work-harvest' }} replace />} />
        <Route path="/ask" element={<Navigate to={{ pathname: '/assistant', hash: location.hash }} replace />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
      <AssistantDrawer
        open={assistantDrawerOpen}
        locale={locale}
        crop={selectedCrop}
        cropLabel={selectedCropLabel}
      panelTabs={assistantSection.tabs}
      activePanel={assistantDrawerPanel}
      summary={smartGrowSummary}
      searchRequest={assistantSearchRequest}
      chatRequest={assistantChatRequest}
        currentData={currentData}
        metrics={deferredModelMetrics}
        forecast={deferredForecast}
        history={deferredHistory}
        producePrices={producePrices}
        weather={weather}
        rtrProfile={selectedRtrProfile}
        smartGrowLoading={isSmartGrowLoading}
        smartGrowError={smartGrowError}
        onClose={() => setAssistantDrawerOpen(false)}
        onSelectPanel={(panelId) => setAssistantDrawerPanel(panelId as AssistantPanelId)}
        onOpenSearch={handleOpenRagAssistant}
      />
      {!location.pathname.startsWith('/assistant') ? (
        <AssistantFab onClick={handleChatToggle} />
      ) : null}
    </AppShell>
  );
}

export default App;
