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
        title: '질문 도우미와 재배 자료',
        description: '농가 질문, 자료 목차 검색, 농약·양액 솔루션을 한 화면에서 이어서 확인합니다.',
      }
    : {
        eyebrow: 'Knowledge',
        title: 'Assistant',
        description: 'Review questions, grower materials, pesticide checks, and nutrient tools in one route.',
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
