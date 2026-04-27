import type { ReactNode } from 'react';
import { BookOpen, MessageCircle, Search, ShieldCheck, type LucideIcon } from 'lucide-react';
import DashboardCard from '../components/common/DashboardCard';
import PageCanvas from '../components/layout/PageCanvas';

interface AssistantPageProps {
  locale: 'ko' | 'en';
  surface: ReactNode;
  summaryRail?: ReactNode;
}

export default function AssistantPage({
  locale,
  surface,
  summaryRail = null,
}: AssistantPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Knowledge',
        title: '질문 도우미와 재배 자료',
        description: '농가 질문, 자료 목차 검색, 농약·양액 솔루션을 한 화면에서 이어서 확인합니다.',
        heroTitle: '질문은 짧게, 자료는 목차처럼, 솔루션은 근거와 함께',
        heroBody: 'LLM 상담, 지식 DB 검색, 농약·양액 도구를 같은 라우트에서 보존하되 각 기능을 탭과 보조 패널로 분리했습니다.',
        ask: '질문',
        askBody: '운영 상황을 농민이 읽기 쉬운 권고 형태로 정리합니다.',
        search: '자료 찾기',
        searchBody: '책 목차처럼 문서 범위를 펼쳐 필요한 페이지로 이동합니다.',
        solution: '농약·양액',
        solutionBody: '백엔드 솔루션 도구와 지식 상태를 같이 봅니다.',
      }
    : {
        eyebrow: 'Knowledge',
        title: 'Assistant',
        description: 'Review questions, grower materials, pesticide checks, and nutrient tools in one route.',
        heroTitle: 'Short questions, table-of-contents materials, source-backed solutions',
        heroBody: 'The LLM chat, knowledge DB search, pesticide checks, and nutrient tools stay on this route with separated panels.',
        ask: 'Ask',
        askBody: 'Summarize operating context into grower-friendly recommendations.',
        search: 'Materials',
        searchBody: 'Browse source coverage like a book table of contents.',
        solution: 'Agronomy tools',
        solutionBody: 'Keep backend solution tools next to knowledge readiness.',
      };
  const summaryItems = [
    { label: copy.ask, body: copy.askBody, Icon: MessageCircle, tone: 'sage' },
    { label: copy.search, body: copy.searchBody, Icon: BookOpen, tone: 'olive' },
    { label: copy.solution, body: copy.solutionBody, Icon: ShieldCheck, tone: 'tomato' },
  ];

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <DashboardCard
        variant="hero"
        eyebrow={locale === 'ko' ? 'KNOWLEDGE WORKSPACE' : 'KNOWLEDGE WORKSPACE'}
        title={copy.heroTitle}
        description={copy.heroBody}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {summaryItems.map((item) => (
            <KnowledgeSummaryCard
              key={item.label}
              label={item.label}
              body={item.body}
              Icon={item.Icon}
              tone={item.tone}
            />
          ))}
        </div>
      </DashboardCard>
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,392px)]">
        <div className="min-w-0">{surface}</div>
        {summaryRail ? <div className="min-w-0">{summaryRail}</div> : null}
      </div>
    </PageCanvas>
  );
}

function KnowledgeSummaryCard({
  label,
  body,
  Icon,
  tone,
}: {
  label: string;
  body: string;
  Icon: LucideIcon;
  tone: string;
}) {
  const iconClass = tone === 'tomato'
    ? 'bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary)]'
    : tone === 'olive'
      ? 'bg-[color:var(--sg-color-olive-soft)] text-[color:var(--sg-color-olive)]'
      : 'bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-success)]';

  return (
    <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[color:var(--sg-text-strong)]">{label}</h3>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sg-radius-md)] ${iconClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--sg-text-muted)]">{body}</p>
      <div className="mt-4 flex items-center gap-2 border-t border-[color:var(--sg-outline-soft)] pt-3 text-xs font-bold text-[color:var(--sg-color-olive)]">
        <Search className="h-4 w-4" aria-hidden="true" />
        <span>RAG / Advisor / SmartGrow</span>
      </div>
    </article>
  );
}
