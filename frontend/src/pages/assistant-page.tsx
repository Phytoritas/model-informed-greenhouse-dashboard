import type { ReactNode } from 'react';
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
        title: '질문 도우미와 자료 찾기',
        description: '채팅 상담, 문서 목차형 검색, AI endpoint 상태를 같은 디자인 시스템 안에서 사용합니다.',
      }
    : {
        eyebrow: 'Knowledge',
        title: 'Assistant',
        description: 'Use chat, table-of-contents search, and AI endpoint status inside the same design system.',
      };

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,392px)]">
        <div className="min-w-0">{surface}</div>
        {summaryRail ? <div className="min-w-0">{summaryRail}</div> : null}
      </div>
    </PageCanvas>
  );
}
