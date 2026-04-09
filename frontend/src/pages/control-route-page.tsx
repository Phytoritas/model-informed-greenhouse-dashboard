import { Suspense, lazy } from 'react';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  ControlStatus,
  ProducePricesPayload,
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
const WeatherOutlookPanel = lazy(() => import('../components/WeatherOutlookPanel'));

interface ControlRoutePageProps {
  locale: AppLocale;
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
}

export default function ControlRoutePage({
  locale,
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
}: ControlRoutePageProps) {
  const fallbackAlerts = alertItems.length
    ? alertItems
    : [{
        id: 'control-ready',
        severity: 'resolved' as const,
        title: locale === 'ko' ? '제어 차단 항목 없음' : 'No active control blocker',
        body: fallbackAlertBody,
      }];

  return (
    <ControlPage
      locale={locale}
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
              title={locale === 'ko' ? '실시간 환경 분석' : 'Real-time Environmental Analysis'}
              loadingMessage={locale === 'ko' ? '실시간 환경 분석 모듈을 불러오는 중...' : 'Loading real-time environmental analysis...'}
              minHeightClassName="min-h-[520px]"
            />
          )}
        >
          <Charts data={history} />
        </Suspense>
      )}
      watchList={(
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
          <Suspense
            fallback={(
              <LoadingSkeleton
                title={locale === 'ko' ? '대구 실시간 날씨' : 'Daegu Live Weather'}
                loadingMessage={locale === 'ko' ? '대구 실시간 날씨 모듈을 불러오는 중...' : 'Loading Daegu live weather...'}
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
