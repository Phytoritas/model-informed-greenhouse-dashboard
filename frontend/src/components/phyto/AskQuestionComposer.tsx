import { MessageCircle, Search } from 'lucide-react';
import DashboardCard from '../common/DashboardCard';

interface AskQuestionComposerProps {
  locale: 'ko' | 'en';
  cropLabel: string;
  onOpenAsk: () => void;
  onOpenSearch: () => void;
  quickSearches: string[];
  onQuickSearch: (query: string) => void;
}

export default function AskQuestionComposer({
  locale,
  cropLabel,
  onOpenAsk,
  onOpenSearch,
  quickSearches,
  onQuickSearch,
}: AskQuestionComposerProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: '질문 흐름',
        title: `${cropLabel} 운영 질문을 바로 시작하세요`,
        description: '먼저 막힌 운영 질문을 적고, 자료 찾기와 후속 질문으로 이어가세요.',
        ask: '질문하기',
        search: '자료 찾기',
        quick: '바로 찾기',
      }
    : {
        eyebrow: 'Question flow',
        title: `Start the next ${cropLabel} operating question`,
        description: 'Begin with the blocked question, then move into search and follow-up explanation.',
        ask: 'Ask',
        search: 'Search',
        quick: 'Find quickly',
      };

  return (
    <DashboardCard
      variant="hero"
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      actions={(
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenAsk}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--sg-text-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--sg-accent-forest)]"
          >
            <MessageCircle className="h-4 w-4" />
            {copy.ask}
          </button>
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--sg-accent-violet)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Search className="h-4 w-4" />
            {copy.search}
          </button>
        </div>
      )}
    >
      <div className="space-y-3">
        <p className="text-sm leading-7 text-[color:var(--sg-text-muted)]">
          {locale === 'ko'
            ? '막힌 판단은 자료를 찾고, 바로 이어서 질문하는 2단계 흐름으로 푸는 것이 가장 빠릅니다.'
            : 'The fastest path is usually a two-step lane: search the right material, then ask the follow-up.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {quickSearches.map((query) => (
            <button
              key={query}
              type="button"
              onClick={() => onQuickSearch(query)}
              className="rounded-full bg-white/86 px-3 py-2 text-xs font-semibold text-[color:var(--sg-text-muted)] transition hover:-translate-y-0.5"
              style={{ boxShadow: 'var(--sg-shadow-card)' }}
            >
              {copy.quick} · {query}
            </button>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
