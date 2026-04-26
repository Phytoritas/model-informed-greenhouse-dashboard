import { Suspense, lazy } from 'react';
import type { AppLocale } from '../i18n/locale';
import type {
  ControlStatus,
  CropType,
  RtrOptimizationMode,
  RtrProfile,
  SensorData,
  TemperatureSettings,
  TelemetryStatus,
  WeatherOutlook,
} from '../types';
import type { AlertRailItem } from '../components/dashboard/AlertRail';
import AlertRail from '../components/dashboard/AlertRail';
import SimulationRuntimePanel from '../components/dashboard/SimulationRuntimePanel';
import ControlPanel from '../components/ControlPanel';
import type { RTROptimizerStateLike, RTROptimizerUiStateLike } from '../components/RTROptimizerPanel';
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
  alertItems: AlertRailItem[];
  fallbackAlertBody: string;
  history: SensorData[];
  currentData: SensorData;
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
  alertItems,
  fallbackAlertBody,
  history,
  currentData,
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
}: ControlRoutePageProps) {
  const fallbackAlerts = alertItems.length
    ? alertItems
    : [{
        id: 'control-ready',
        severity: 'resolved' as const,
        title: locale === 'ko' ? '제어 차단 항목 없음' : 'No urgent warning',
        body: fallbackAlertBody,
      }];

  return (
    <ControlPage
      locale={locale}
      activePanel={activePanel}
      strategySurface={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '추천 제어안' : 'Recommended control'}
              loadingMessage={locale === 'ko' ? '추천 제어안을 불러오는 중입니다...' : 'Loading recommended control...'}
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
      controlActions={<AlertRail items={fallbackAlerts} compact />}
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
