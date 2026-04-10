import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface AlertsPageProps {
  locale: 'ko' | 'en';
  surface: ReactNode;
  tabs?: Array<{ id: string; label: string }>;
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
        title: '경보',
        description: '즉시 확인, 오늘 확인, 추적 중을 한 화면에서 모읍니다.',
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
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
    >
      <div className="min-w-0">{surface}</div>
    </PageCanvas>
  );
}
