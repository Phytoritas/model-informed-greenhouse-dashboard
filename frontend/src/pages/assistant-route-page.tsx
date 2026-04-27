import { Suspense, lazy } from 'react';
import PageSectionTabs from '../components/phyto/PageSectionTabs';
import AskSearchPage from '../components/phyto/AskSearchPage';
import AiCompatibilityPanel from '../components/assistant/AiCompatibilityPanel';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { SmartGrowAdvisorySurfaceSummary, SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
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
import type { RagAssistantOpenRequest } from '../components/chat/ragAssistantTypes';
import type { PhytoSectionTab } from '../routes/phytosyncSections';
import AssistantPage from './assistant-page';

const SmartGrowSurfacePanel = lazy(() => import('../components/SmartGrowSurfacePanel'));

interface AssistantRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  cropLabel: string;
  panelTabs: PhytoSectionTab[];
  onSelectPanel: (panelId: string) => void;
  summary: SmartGrowKnowledgeSummary | null;
  activePanel?: 'assistant-chat' | 'assistant-search' | 'assistant-history';
  searchRequest?: RagAssistantOpenRequest | null;
  chatRequest?: { query: string; nonce: number } | null;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
  forecast?: ForecastData | null;
  history?: SensorData[];
  producePrices?: ProducePricesPayload | null;
  weather?: WeatherOutlook | null;
  rtrProfile?: RtrProfile | null;
  smartGrowLoading?: boolean;
  smartGrowError?: string | null;
  onOpenSearch: (request?: Omit<RagAssistantOpenRequest, 'nonce'>) => void;
  onOpenSurface?: (surfaceKey: SmartGrowAdvisorySurfaceSummary['key']) => void;
}

export default function AssistantRoutePage({
  locale,
  crop,
  cropLabel,
  panelTabs,
  onSelectPanel,
  summary,
  activePanel = 'assistant-chat',
  searchRequest = null,
  chatRequest = null,
  currentData,
  metrics,
  forecast = null,
  history = [],
  producePrices = null,
  weather = null,
  rtrProfile = null,
  smartGrowLoading = false,
  smartGrowError = null,
  onOpenSearch,
  onOpenSurface,
}: AssistantRoutePageProps) {
  return (
    <AssistantPage
      locale={locale}
      surface={(
        <div className="space-y-6">
          <PageSectionTabs
            tabs={panelTabs}
            activeId={activePanel}
            onSelect={onSelectPanel}
          />
          <AskSearchPage
            locale={locale}
            crop={crop}
            cropLabel={cropLabel}
            summary={summary}
            activePanel={activePanel}
            searchRequest={searchRequest}
            chatRequest={chatRequest}
            currentData={currentData}
            metrics={metrics}
            forecast={forecast}
            history={history}
            producePrices={producePrices}
            weather={weather}
            rtrProfile={rtrProfile}
            smartGrowLoading={smartGrowLoading}
            smartGrowError={smartGrowError}
            onOpenSearch={onOpenSearch}
          />
        </div>
      )}
      summaryRail={(
        <div className="space-y-6">
          <AiCompatibilityPanel
            locale={locale}
            crop={crop}
            currentData={currentData}
            metrics={metrics}
            forecast={forecast}
            history={history}
            producePrices={producePrices}
            weather={weather}
            rtrProfile={rtrProfile}
          />
          <Suspense
            fallback={(
              <LoadingSkeleton
                title={locale === 'ko' ? '운영 솔루션 도구' : 'Operating solution tools'}
                loadingMessage={locale === 'ko' ? '자료 기반 솔루션 도구를 불러오는 중입니다...' : 'Loading source-backed solution tools...'}
                minHeightClassName="min-h-[320px]"
              />
            )}
          >
            <SmartGrowSurfacePanel
              crop={crop}
              summary={summary}
              loading={smartGrowLoading}
              error={smartGrowError}
              onOpenSurface={onOpenSurface}
              layoutMode="compact"
            />
          </Suspense>
        </div>
      )}
    />
  );
}
