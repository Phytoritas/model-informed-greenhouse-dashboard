import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface OverviewPageProps {
  locale: 'ko' | 'en';
  metricDeck: ReactNode;
  heroCard: ReactNode;
  priorityRail: ReactNode;
  leadAnalytics: ReactNode;
  sideAnalytics: ReactNode;
  recentActivity: ReactNode;
  tabs?: Array<{ id: string; label: string }>;
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function OverviewPage({
  locale,
  metricDeck,
  heroCard,
  priorityRail,
  leadAnalytics,
  sideAnalytics,
  recentActivity,
  tabs = [],
  activeTabId,
  onSelectTab,
}: OverviewPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '오늘 운영',
        description: '지금 먼저 볼 값과 오늘 조치가 한눈에 보입니다.',
        priority: '지금 먼저 확인',
        analytics: '대표 흐름',
        recent: '최근 조치',
      }
    : {
        eyebrow: 'Overview',
        title: 'Today operations',
        description: 'See the live signals and today’s next moves at a glance.',
        priority: 'Review first',
        analytics: 'Main trend',
        recent: 'Recent actions',
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-8 xl:auto-rows-[88px] xl:grid-cols-12">
        <div className="min-h-0 xl:col-span-8 xl:row-span-2 [&>*]:h-full">{heroCard}</div>
        <div className="min-h-0 xl:col-span-4 xl:row-span-2">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
            {copy.priority}
          </div>
          <div className="[&>*]:h-full">{priorityRail}</div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:col-span-12 xl:grid-cols-6">
          {metricDeck}
        </div>
        <div className="min-h-0 xl:col-span-8 xl:row-span-3">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
            {copy.analytics}
          </div>
          <div className="[&>*]:h-full">{leadAnalytics}</div>
        </div>
        <div className="min-h-0 xl:col-span-4 xl:row-span-2 [&>*]:h-full">{sideAnalytics}</div>
        <div className="min-h-0 xl:col-span-12 xl:row-span-3">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
            {copy.recent}
          </div>
          <div className="[&>*]:h-full">{recentActivity}</div>
        </div>
      </div>
    </PageCanvas>
  );
}
