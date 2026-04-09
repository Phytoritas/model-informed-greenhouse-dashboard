import type { ReactNode } from 'react';
import PageHeader from '../components/common/PageHeader';

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
        eyebrow: 'Assistant',
        title: 'AI 도우미',
        description: '질문, 자료 찾기, 최근 추천을 한 페이지로 정리합니다.',
      }
    : {
        eyebrow: 'Assistant',
        title: 'Assistant',
        description: 'Keep ask, search, and recent recommendations in one route.',
      };

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,392px)]">
        <div className="min-w-0">{surface}</div>
        {summaryRail ? <div className="min-w-0">{summaryRail}</div> : null}
      </div>
    </div>
  );
}
