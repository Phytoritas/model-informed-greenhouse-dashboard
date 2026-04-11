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

interface AskSearchPageProps {
  locale: 'ko' | 'en';
  crop: CropType;
  cropLabel: string;
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
}

export default function AskSearchPage({
  locale,
  crop,
  cropLabel,
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
  const resolvedPanel = activePanel === 'assistant-history' ? 'assistant-search' : activePanel;

  return (
    <div className="space-y-6">
      {resolvedPanel === 'assistant-chat' ? (
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
          initialUserQuery={chatRequest}
          onOpenKnowledgeSearch={onOpenSearch}
        />
      ) : null}
      {resolvedPanel === 'assistant-search' ? (
        <AskKnowledgeBoard
          locale={locale}
          crop={crop}
          cropLabel={cropLabel}
          query={searchDraft}
          onQueryChange={handleSearchDraftChange}
          searchRequest={searchRequest}
        />
      ) : null}
    </div>
  );
}
