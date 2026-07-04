import { Suspense, lazy } from 'react';
import type { AppLocale } from '../i18n/locale';
import type {
  CropType,
  RtrOptimizationMode,
  RtrProfile,
  SensorData,
  TemperatureSettings,
  TelemetryStatus,
  WeatherOutlook,
} from '../types';
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
  optimizerState?: RTROptimizerStateLike;
  uiState?: RTROptimizerUiStateLike;
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
  optimizerState,
  uiState,
}: RtrRoutePageProps) {
  return (
    <RtrPage
      locale={locale}
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
    />
  );
}
