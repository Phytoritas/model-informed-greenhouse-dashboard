import type { ReactNode } from 'react';
import PageCanvas, { type PageCanvasTab } from '../components/layout/PageCanvas';

interface AlertsPageProps {
  locale: 'ko' | 'en';
  surface: ReactNode;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function AlertsPage({
  locale,
  surface,
  tabs = [],
  activeTabId,
  onSelectTab,
}: AlertsPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '긴급 알림',
        description: '긴급 알림, 확인 필요, 처리 이력을 한 화면에서 모읍니다.',
      }
    : {
        eyebrow: 'Alerts',
        title: 'Alerts',
        description: 'Separate urgent response, review, and history in one page.',
      };

  return (
    <PageCanvas
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      hideHeader
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
    >
      <div className="min-w-0">{surface}</div>
    </PageCanvas>
  );
}
