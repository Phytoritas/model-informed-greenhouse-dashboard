import type { ReactNode } from 'react';
import PageCanvas, { type PageCanvasTab } from '../components/layout/PageCanvas';

interface ResourcesPageProps {
  locale: 'ko' | 'en';
  surface: ReactNode;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function ResourcesPage({
  locale,
  surface,
  tabs = [],
  activeTabId,
  onSelectTab,
}: ResourcesPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '\uC591\uC561\uC5D0\uB108\uC9C0',
        description: '\uC591\uC561, \uBC30\uC561, \uC5D0\uB108\uC9C0, \uBE44\uC6A9, \uC2DC\uC138 \uD750\uB984\uC744 \uD55C\uACF3\uC5D0\uC11C \uBD05\uB2C8\uB2E4.',
      }
    : {
        eyebrow: 'Resources',
        title: 'Resources',
        description: 'Review nutrient, energy, and market signals in a separate lane.',
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
