import { useState } from 'react';
import type { SmartGrowKnowledgeSummary } from '../../hooks/useSmartGrowKnowledge';
import type { CropType } from '../../types';
import AskKnowledgeBoard from './AskKnowledgeBoard';
import AskQuestionComposer from './AskQuestionComposer';
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
  onOpenAsk: () => void;
  onOpenSearch: () => void;
  activePanel?: 'ask-chat' | 'ask-search' | 'ask-history';
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
  onOpenAsk,
  onOpenSearch,
  activePanel = 'ask-chat',
}: AskSearchPageProps) {
  const [searchDraft, setSearchDraft] = useState('');
  const [searchRequest, setSearchRequest] = useState<{ query: string; nonce: number } | null>(null);
  const quickSearches = locale === 'ko'
    ? [
        `${cropLabel} 환경 제어 기준`,
        `${cropLabel} 양액 경계 조건`,
        `${cropLabel} 방제 교호 전략`,
      ]
    : [
        `${cropLabel} environment control guidance`,
        `${cropLabel} nutrient guardrails`,
        `${cropLabel} protection rotation`,
      ];

  return (
    <div className="space-y-6">
      {activePanel === 'ask-chat' ? (
        <AskQuestionComposer
          locale={locale}
          cropLabel={cropLabel}
          onOpenAsk={onOpenAsk}
          onOpenSearch={onOpenSearch}
          quickSearches={quickSearches}
          onQuickSearch={(query) => {
            setSearchDraft(query);
            setSearchRequest({ query, nonce: Date.now() });
          }}
        />
      ) : null}
      {activePanel === 'ask-search' ? (
        <AskKnowledgeBoard
          locale={locale}
          crop={crop}
          cropLabel={cropLabel}
          query={searchDraft}
          onQueryChange={setSearchDraft}
          searchRequest={searchRequest}
          onOpenSearch={onOpenSearch}
        />
      ) : null}
      {activePanel === 'ask-history' ? (
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
