import { Suspense, lazy } from 'react';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrProfile,
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
  history?: SensorData[];
  forecast?: ForecastData | null;
  summary?: SmartGrowKnowledgeSummary | null;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  rtrProfile?: RtrProfile | null;
  produceLoading: boolean;
  produceError: string | null;
  activePanel?: 'resources-nutrient' | 'resources-energy' | 'resources-market';
  initialCorrectionToolOpen?: boolean;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function ResourcesRoutePage({
  locale,
  crop,
  cropLabel,
  currentData,
  modelMetrics,
  history = [],
  forecast = null,
  summary = null,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  rtrProfile = null,
  produceLoading,
  produceError,
  activePanel = 'resources-energy',
  initialCorrectionToolOpen = false,
  tabs = [],
  activeTabId,
  onSelectTab,
}: ResourcesRoutePageProps) {
  return (
    <ResourcesPage
      locale={locale}
      tabs={tabs}
      activeTabId={activeTabId ?? activePanel}
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
            crop={crop}
            cropLabel={cropLabel}
            currentData={currentData}
            modelMetrics={modelMetrics}
            history={history}
            forecast={forecast}
            summary={summary}
            weather={weather}
            weatherLoading={weatherLoading}
            weatherError={weatherError}
            producePrices={producePrices}
            rtrProfile={rtrProfile}
            produceLoading={produceLoading}
            produceError={produceError}
            activePanel={activePanel}
            initialCorrectionToolOpen={initialCorrectionToolOpen}
          />
        </Suspense>
      )}
    />
  );
}
