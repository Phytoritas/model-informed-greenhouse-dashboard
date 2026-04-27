import type { ReactNode } from 'react';
import PageHeader from '../common/PageHeader';
import PageSectionTabs from '../phyto/PageSectionTabs';

interface PageCanvasTab {
  id: string;
  label: string;
}

interface PageCanvasProps {
  eyebrow?: string;
  title: string;
  description: string;
  hideHeader?: boolean;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageCanvas({
  eyebrow,
  title,
  description,
  hideHeader = false,
  tabs = [],
  activeTabId,
  onSelectTab,
  actions,
  children,
}: PageCanvasProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
      {hideHeader ? null : <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />}
      {tabs.length > 0 ? (
        <div className="min-w-0">
          <PageSectionTabs tabs={tabs} activeId={activeTabId} onSelect={onSelectTab} />
        </div>
      ) : null}
      {children}
    </div>
  );
}
