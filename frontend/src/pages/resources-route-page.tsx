import { Suspense, lazy } from 'react';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  ProducePricesPayload,
  SensorData,
  WeatherOutlook,
} from '../types';
import ResourcesPage from './resources-page';

const ResourcesCommandCenter = lazy(() => import('../components/resources/ResourcesCommandCenter'));

interface ResourcesRoutePageProps {
  locale: AppLocale;
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
  tabs: Array<{ id: string; label: string }>;
  onSelectTab: (tabId: string) => void;
}

export default function ResourcesRoutePage({
  locale,
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
  tabs,
  onSelectTab,
}: ResourcesRoutePageProps) {
  const activeTabId = activePanel === 'resources-stock' ? 'resources-nutrient' : activePanel;

  return (
    <ResourcesPage
      locale={locale}
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
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
