import { Suspense, lazy } from 'react';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  ControlStatus,
  CropType,
  ProducePricesPayload,
  RtrOptimizationMode,
  RtrProfile,
  SensorData,
  TemperatureSettings,
  TelemetryStatus,
  WeatherOutlook,
} from '../types';
import ControlPanel from '../components/ControlPanel';
import DecisionSnapshotGrid from '../components/dashboard/DecisionSnapshotGrid';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { RTROptimizerStateLike, RTROptimizerUiStateLike } from '../components/RTROptimizerPanel';
import RtrPage from './rtr-page';

const RTROptimizerPanel = lazy(() => import('../components/RTROptimizerPanel'));

interface RtrRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  currentData: SensorData;
  history: SensorData[];
  telemetryStatus?: TelemetryStatus;
  temperatureSettings: TemperatureSettings;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  profile: RtrProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  optimizerEnabled?: boolean;
  defaultMode?: RtrOptimizationMode;
  onRefreshProfiles?: () => void | Promise<void>;
  controls: ControlStatus;
  onToggle: (key: keyof ControlStatus) => void;
  onSettingsChange: (settings: TemperatureSettings) => void;
  modelMetrics: AdvancedModelMetrics;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
  optimizerState?: RTROptimizerStateLike;
  uiState?: RTROptimizerUiStateLike;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function RtrRoutePage({
  locale,
  crop,
  currentData,
  history,
  telemetryStatus,
  temperatureSettings,
  weather,
  weatherLoading,
  weatherError,
  profile,
  profileLoading,
  profileError,
  optimizerEnabled,
  defaultMode,
  onRefreshProfiles,
  controls,
  onToggle,
  onSettingsChange,
  modelMetrics,
  producePrices,
  produceLoading,
  optimizerState,
  uiState,
  tabs = [],
  activeTabId,
  onSelectTab,
}: RtrRoutePageProps) {
  return (
    <RtrPage
      locale={locale}
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
      recommendationSurface={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? 'RTR 전략' : 'RTR Strategy'}
              loadingMessage={locale === 'ko' ? 'RTR 전략 모듈을 불러오는 중...' : 'Loading RTR strategy...'}
              minHeightClassName="min-h-[360px]"
            />
          )}
        >
          <RTROptimizerPanel
            key={crop}
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
      )}
      supportSurface={(
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <ControlPanel
            status={controls}
            onToggle={onToggle}
            onSettingsChange={onSettingsChange}
          />
          <DecisionSnapshotGrid
            crop={crop}
            currentData={currentData}
            modelMetrics={modelMetrics}
            weather={weather}
            weatherLoading={weatherLoading}
            producePrices={producePrices}
            produceLoading={produceLoading}
            history={history}
          />
        </div>
      )}
    />
  );
}
