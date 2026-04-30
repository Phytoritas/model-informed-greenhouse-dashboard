import { Suspense, lazy } from 'react';
import AskSearchPage from '../components/phyto/AskSearchPage';
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
  activePanel?: 'assistant-chat' | 'assistant-search' | 'assistant-history' | 'assistant-solutions';
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
  onOpenAssistant: () => void;
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
  onOpenAssistant,
}: AssistantRoutePageProps) {
  return (
    <AssistantPage
      locale={locale}
      crop={crop}
      cropLabel={cropLabel}
      currentData={currentData}
      metrics={metrics}
      forecast={forecast}
      history={history}
      producePrices={producePrices}
      weather={weather}
      rtrProfile={rtrProfile}
      summary={summary}
      smartGrowLoading={smartGrowLoading}
      smartGrowError={smartGrowError}
      sectionTabs={panelTabs}
      activeSectionId={activePanel}
      onSelectSection={onSelectPanel}
      onOpenAssistant={onOpenAssistant}
      surface={(
        <div className="space-y-6">
          {activePanel === 'assistant-solutions' ? (
            <section id="assistant-solutions" className="scroll-mt-24" tabIndex={-1}>
              <Suspense
                fallback={(
                  <LoadingSkeleton
                    title={locale === 'ko' ? '재배 솔루션' : 'Operating solution tools'}
                    loadingMessage={locale === 'ko' ? '농약·양액 솔루션을 불러오는 중입니다...' : 'Loading source-backed solution tools...'}
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
            </section>
          ) : (
            <section id={activePanel === 'assistant-search' ? 'assistant-search' : 'assistant-chat'} className="scroll-mt-24" tabIndex={-1}>
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
            </section>
          )}
        </div>
      )}
    />
  );
}
