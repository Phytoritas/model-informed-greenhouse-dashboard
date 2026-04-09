import type { SmartGrowKnowledgeSummary } from '../../hooks/useSmartGrowKnowledge';
import AskQuestionComposer from './AskQuestionComposer';
import AskRecentFlow from './AskRecentFlow';
import AskResultSummary from './AskResultSummary';

interface AskSearchPageProps {
  locale: 'ko' | 'en';
  cropLabel: string;
  summary: SmartGrowKnowledgeSummary | null;
  actionsNow: string[];
  actionsToday: string[];
  note: string;
  signals: Array<{ label: string; value: string }>;
  onOpenAsk: () => void;
  onOpenSearch: () => void;
  onQuickSearch: (query: string) => void;
}

export default function AskSearchPage({
  locale,
  cropLabel,
  summary,
  actionsNow,
  actionsToday,
  note,
  signals,
  onOpenAsk,
  onOpenSearch,
  onQuickSearch,
}: AskSearchPageProps) {
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
      <AskQuestionComposer
        locale={locale}
        cropLabel={cropLabel}
        onOpenAsk={onOpenAsk}
        onOpenSearch={onOpenSearch}
        quickSearches={quickSearches}
        onQuickSearch={onQuickSearch}
      />
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
    </div>
  );
}
