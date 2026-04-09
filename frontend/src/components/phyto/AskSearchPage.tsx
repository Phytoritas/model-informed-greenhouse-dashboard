import { useState } from 'react';
import type { SmartGrowKnowledgeSummary } from '../../hooks/useSmartGrowKnowledge';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  WeatherOutlook,
} from '../../types';
import type { RagAssistantOpenRequest } from '../chat/ragAssistantTypes';
import ChatAssistant from '../ChatAssistant';
import AskKnowledgeBoard from './AskKnowledgeBoard';
import AskRecentFlow from './AskRecentFlow';
import AskResultSummary from './AskResultSummary';

interface AskSearchPageProps {
  locale: 'ko' | 'en';
  crop: CropType;
  cropLabel: string;
  summary: SmartGrowKnowledgeSummary | null;
  actionsNow: string[];
  actionsToday: string[];
  note: string;
  signals: Array<{ label: string; value: string }>;
  activePanel?: 'assistant-chat' | 'assistant-search' | 'assistant-history';
  searchRequest?: RagAssistantOpenRequest | null;
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
}

export default function AskSearchPage({
  locale,
  crop,
  cropLabel,
  summary,
  actionsNow,
  actionsToday,
  note,
  signals,
  activePanel = 'assistant-chat',
  searchRequest = null,
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
}: AskSearchPageProps) {
  const [draftState, setDraftState] = useState<{ value: string; seedNonce: number | null }>({
    value: '',
    seedNonce: null,
  });
  const searchDraft = searchRequest?.query?.trim() && draftState.seedNonce !== searchRequest.nonce
    ? searchRequest.query
    : draftState.value;

  const handleSearchDraftChange = (query: string) => {
    setDraftState((current) => ({
      value: query,
      seedNonce: searchRequest?.nonce ?? current.seedNonce,
    }));
  };

  return (
    <div className="space-y-6">
      {activePanel === 'assistant-chat' ? (
        <ChatAssistant
          isOpen
          layoutMode="inline"
          currentData={currentData}
          metrics={metrics}
          crop={crop}
          forecast={forecast}
          history={history}
          producePrices={producePrices}
          weather={weather}
          rtrProfile={rtrProfile}
          smartGrowSummary={summary}
          smartGrowLoading={smartGrowLoading}
          smartGrowError={smartGrowError}
          onOpenKnowledgeSearch={onOpenSearch}
        />
      ) : null}
      {activePanel === 'assistant-search' ? (
        <AskKnowledgeBoard
          locale={locale}
          crop={crop}
          cropLabel={cropLabel}
          query={searchDraft}
          onQueryChange={handleSearchDraftChange}
          searchRequest={searchRequest}
        />
      ) : null}
      {activePanel === 'assistant-history' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <AskRecentFlow
            locale={locale}
            nowItems={actionsNow}
            todayItems={actionsToday}
            pendingParsers={summary?.pendingParsers ?? []}
          />
          <AskResultSummary
            locale={locale}
            readyTools={summary?.advisorySurfaceNames ?? []}
            note={note}
            signals={signals}
          />
        </div>
      ) : null}
    </div>
  );
}
