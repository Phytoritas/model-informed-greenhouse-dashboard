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
        eyebrow: 'PhytoSync',
        title: '질문 도우미',
        description: '질문, 자료 찾기, 최근 흐름을 한곳에서 봅니다.',
      }
    : {
        eyebrow: 'PhytoSync',
        title: 'Assistant',
        description: 'Keep ask, search, and recent flow together.',
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
