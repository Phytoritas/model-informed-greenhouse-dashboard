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
  WeatherOutlook,
} from '../types';
import type { AlertRailItem } from '../components/dashboard/AlertRail';
import AlertRail from '../components/dashboard/AlertRail';
import ControlPanel from '../components/ControlPanel';
import DecisionSnapshotGrid from '../components/dashboard/DecisionSnapshotGrid';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import ControlPage from './control-page';

const Charts = lazy(() => import('../components/Charts'));
const RTROptimizerPanel = lazy(() => import('../components/RTROptimizerPanel'));
const WeatherOutlookPanel = lazy(() => import('../components/WeatherOutlookPanel'));

interface ControlRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  controls: ControlStatus;
  onToggle: (key: keyof ControlStatus) => void;
  onSettingsChange: (settings: TemperatureSettings) => void;
  alertItems: AlertRailItem[];
  fallbackAlertBody: string;
  history: SensorData[];
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
  temperatureSettings: TemperatureSettings;
  profile: RtrProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  optimizerEnabled?: boolean;
  defaultMode?: RtrOptimizationMode;
  onRefreshProfiles?: () => void | Promise<void>;
  tabs: Array<{ id: string; label: string }>;
  activeTabId?: string;
  onSelectTab: (tabId: string) => void;
}

export default function ControlRoutePage({
  locale,
  crop,
  controls,
  onToggle,
  onSettingsChange,
  alertItems,
  fallbackAlertBody,
  history,
  currentData,
  modelMetrics,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  produceLoading,
  temperatureSettings,
  profile,
  profileLoading,
  profileError,
  optimizerEnabled,
  defaultMode,
  onRefreshProfiles,
  tabs,
  activeTabId,
  onSelectTab,
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
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
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
      controlActions={<AlertRail items={fallbackAlerts} />}
      climateChart={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '실내 환경 추이' : 'Indoor climate'}
              loadingMessage={locale === 'ko' ? '실내 환경 흐름을 불러오는 중...' : 'Loading indoor climate...'}
              minHeightClassName="min-h-[304px]"
            />
          )}
        >
          <Charts data={history} />
        </Suspense>
      )}
      watchList={(
        <div className="grid gap-5">
          <Suspense
            fallback={(
            <LoadingSkeleton
                title={locale === 'ko' ? '외기와 예보' : 'Outside outlook'}
                loadingMessage={locale === 'ko' ? '외기와 예보 흐름을 불러오는 중...' : 'Loading outside outlook...'}
                minHeightClassName="min-h-[320px]"
              />
            )}
          >
            <WeatherOutlookPanel
              weather={weather}
              loading={weatherLoading}
              error={weatherError}
            />
          </Suspense>
          <DecisionSnapshotGrid
            currentData={currentData}
            modelMetrics={modelMetrics}
            weather={weather}
            weatherLoading={weatherLoading}
            producePrices={producePrices}
            produceLoading={produceLoading}
          />
        </div>
      )}
    />
  );
}
