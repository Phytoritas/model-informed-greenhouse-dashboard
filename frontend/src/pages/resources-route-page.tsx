import { Suspense, lazy } from 'react';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  ProducePricesPayload,
  SensorData,
  WeatherOutlook,
} from '../types';
import ResourcesPage from './resources-page';

const ResourcesCommandCenter = lazy(() => import('../components/resources/ResourcesCommandCenter'));

interface ResourcesRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  cropLabel: string;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
  produceError: string | null;
  activePanel?: 'resources-energy' | 'resources-market' | 'resources-stock';
}

export default function ResourcesRoutePage({
  locale,
  crop,
  cropLabel,
  currentData,
  modelMetrics,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  produceLoading,
  produceError,
  activePanel = 'resources-energy',
}: ResourcesRoutePageProps) {
  return (
    <ResourcesPage
      locale={locale}
      surface={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '자원과 비용' : 'Resources and cost'}
              loadingMessage={locale === 'ko' ? '자원 운영 화면을 불러오는 중입니다...' : 'Loading resource cockpit...'}
              minHeightClassName="min-h-[520px]"
            />
          )}
        >
          <ResourcesCommandCenter
            locale={locale}
            crop={crop}
            cropLabel={cropLabel}
            currentData={currentData}
            modelMetrics={modelMetrics}
            weather={weather}
            weatherLoading={weatherLoading}
            weatherError={weatherError}
            producePrices={producePrices}
            produceLoading={produceLoading}
            produceError={produceError}
            activePanel={activePanel}
          />
        </Suspense>
      )}
    />
  );
}
