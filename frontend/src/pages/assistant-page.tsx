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
  // The workspace TopBar already shows the page title and the panel actions
  // live in WorkspaceTopNav, so the assistant canvas skips its own header to
  // avoid repeating the same label three times.
  const title = locale === 'ko' ? '질문 도우미' : 'Assistant';

  return (
    <PageCanvas title={title} description="" hideHeader>
      <h2 className="sr-only">{title}</h2>
      <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,392px)]">
        <div className="min-w-0">{surface}</div>
        {summaryRail ? <div className="min-w-0">{summaryRail}</div> : null}
      </div>
    </PageCanvas>
  );
}
