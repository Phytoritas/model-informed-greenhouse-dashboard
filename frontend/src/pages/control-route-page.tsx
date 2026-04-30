import { Suspense, lazy } from 'react';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  ControlStatus,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrOptimizationMode,
  RtrProfile,
  SensorData,
  TemperatureSettings,
  TelemetryStatus,
  WeatherOutlook,
} from '../types';
import type { AlertRailItem } from '../components/dashboard/AlertRail';
import SimulationRuntimePanel from '../components/dashboard/SimulationRuntimePanel';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import ControlPanel from '../components/ControlPanel';
import AdvisorTabs from '../components/advisor/AdvisorTabs';
import type { RTROptimizerStateLike, RTROptimizerUiStateLike } from '../components/RTROptimizerPanel';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import ControlPage, { type ControlPagePanelId } from './control-page';

const RTROptimizerPanel = lazy(() => import('../components/RTROptimizerPanel'));

interface ControlRoutePageProps {
  locale: AppLocale;
  activePanel?: ControlPagePanelId;
  crop: CropType;
  telemetryStatus: TelemetryStatus;
  telemetryDetail?: string | null;
  controls: ControlStatus;
  onToggle: (key: keyof ControlStatus) => void;
  onSettingsChange: (settings: TemperatureSettings) => void;
  summary?: SmartGrowKnowledgeSummary | null;
  alertItems: AlertRailItem[];
  fallbackAlertBody: string;
  history: SensorData[];
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  forecast?: ForecastData | null;
  producePrices?: ProducePricesPayload | null;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  temperatureSettings: TemperatureSettings;
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
  onCropChange?: (crop: CropType) => void;
  onOpenAssistant?: () => void;
}

export default function ControlRoutePage({
  locale,
  activePanel = 'control-strategy',
  crop,
  telemetryStatus,
  telemetryDetail = null,
  controls,
  onToggle,
  onSettingsChange,
  summary = null,
  history,
  currentData,
  modelMetrics,
  forecast = null,
  producePrices = null,
  weather,
  weatherLoading,
  weatherError,
  temperatureSettings,
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
  onCropChange,
  onOpenAssistant = () => undefined,
}: ControlRoutePageProps) {
  return (
    <ControlPage
      locale={locale}
      crop={crop}
      activePanel={activePanel}
      currentData={currentData}
      modelMetrics={modelMetrics}
      history={history}
      telemetryStatus={telemetryStatus}
      temperatureSettings={temperatureSettings}
      profile={profile}
      controls={controls}
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
      onCropChange={onCropChange}
      onOpenAssistant={onOpenAssistant}
      strategySurface={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '환경 솔루션' : 'Climate solutions'}
              loadingMessage={locale === 'ko' ? '환경 솔루션을 불러오는 중입니다...' : 'Loading climate solutions...'}
              minHeightClassName="min-h-[304px]"
            />
          )}
        >
          <RTROptimizerPanel
            key={crop}
            crop={crop}
            currentData={currentData}
            history={history}
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
            compact
          />
        </Suspense>
      )}
      controlSummary={(
        <ControlPanel
          status={controls}
          onToggle={onToggle}
          onSettingsChange={onSettingsChange}
        />
      )}
      environmentAdvisorSurface={(
        <AdvisorTabs
          key={`${crop}-environment`}
          crop={crop}
          summary={summary}
          currentData={currentData}
          metrics={modelMetrics}
          history={history}
          forecast={forecast}
          producePrices={producePrices}
          weather={weather}
          rtrProfile={profile}
          isOpen
          initialTab="environment"
          onClose={() => undefined}
          showCloseAction={false}
        />
      )}
      runtimeSurface={(
        <SimulationRuntimePanel
          locale={locale}
          crop={crop}
          telemetryStatus={telemetryStatus}
          telemetryDetail={telemetryDetail}
        />
      )}
    />
  );
}
