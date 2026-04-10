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
  const selectedTabId = activeTabId ?? tabs[0]?.id ?? 'overview-core';
  const showOperationsLane = selectedTabId === 'overview-core';
  const showDashboardLane = selectedTabId === 'overview-dashboard';
  const showWatchLane = selectedTabId === 'overview-watch';

  const copy = locale === 'ko'
    ? {
        title: '오늘 운영',
        priority: '지금 먼저 확인',
        analytics: '대표 흐름',
        recent: '최근 조치',
      }
    : {
        title: 'Today operations',
        priority: 'Review first',
        analytics: 'Main trend',
        recent: 'Recent actions',
      };

  return (
    <PageCanvas
      title={copy.title}
      description=""
      hideHeader
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {showOperationsLane ? (
          <>
            <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{heroCard}</div>
            <div className="min-h-0 xl:col-span-4">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                  {copy.priority}
                </div>
                <div className="min-h-0 [&>*]:h-full">{priorityRail}</div>
              </div>
            </div>
            <div className="min-h-0 xl:col-span-12">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                  {copy.recent}
                </div>
                <div className="min-h-0 [&>*]:h-full">{recentActivity}</div>
              </div>
            </div>
          </>
        ) : null}
        {showDashboardLane ? (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:col-span-12 xl:grid-cols-6">
              {metricDeck}
            </div>
            <div className="min-h-0 xl:col-span-8">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                  {copy.analytics}
                </div>
                <div className="min-h-0 [&>*]:h-full">{leadAnalytics}</div>
              </div>
            </div>
            <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{sideAnalytics}</div>
          </>
        ) : null}
        {showWatchLane ? (
          <>
            <div className="min-h-0 xl:col-span-8">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                  {copy.priority}
                </div>
                <div className="min-h-0 [&>*]:h-full">{priorityRail}</div>
              </div>
            </div>
            <div className="min-h-0 xl:col-span-4">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                  {copy.recent}
                </div>
                <div className="min-h-0 [&>*]:h-full">{recentActivity}</div>
              </div>
            </div>
          </>
        ) : null}
        {!showOperationsLane && !showDashboardLane && !showWatchLane ? (
          <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{heroCard}</div>
        ) : null}
      </div>
    </PageCanvas>
  );
}
