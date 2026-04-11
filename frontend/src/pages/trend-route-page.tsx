import { Suspense, lazy } from 'react';
import DecisionSnapshotGrid from '../components/dashboard/DecisionSnapshotGrid';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  ProducePricesPayload,
  SensorData,
  WeatherOutlook,
} from '../types';
import TrendPage from './trend-page';

const WeatherOutlookPanel = lazy(() => import('../components/WeatherOutlookPanel'));

interface TrendRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  history: SensorData[];
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
}

export default function TrendRoutePage({
  locale,
  crop,
  currentData,
  modelMetrics,
  history,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  produceLoading,
}: TrendRoutePageProps) {
  return (
    <TrendPage
      weatherSurface={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '날씨와 시세' : 'Weather trend'}
              loadingMessage={locale === 'ko' ? '날씨 흐름을 불러오는 중입니다...' : 'Loading weather trend...'}
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
      )}
      marketSurface={(
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
      )}
    />
  );
}
