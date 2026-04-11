import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface OverviewPageProps {
  locale: 'ko' | 'en';
  metricDeck: ReactNode;
  heroCard: ReactNode;
  heroSupplement?: ReactNode;
  operationsAside?: ReactNode;
  priorityRail: ReactNode;
  priorityTrend?: ReactNode;
  leadAnalytics: ReactNode;
  sideAnalytics: ReactNode;
  recentActivity: ReactNode;
  activeTabId?: string;
}

export default function OverviewPage({
  locale,
  metricDeck,
  heroCard,
  heroSupplement,
  operationsAside,
  priorityRail,
  priorityTrend,
  leadAnalytics,
  sideAnalytics,
  recentActivity,
  activeTabId,
}: OverviewPageProps) {
  const selectedTabId = activeTabId ?? 'overview-core';
  const showOperationsLane = selectedTabId === 'overview-core';
  const showDashboardLane = selectedTabId === 'overview-dashboard';
  const showWatchLane = selectedTabId === 'overview-watch';

  const copy = locale === 'ko'
    ? {
        title: '오늘 운영',
        analytics: '대표 흐름',
        recent: '최근 조치',
      }
    : {
        title: 'Today operations',
        analytics: 'Main trend',
        recent: 'Recent actions',
      };

  return (
    <PageCanvas
      title={copy.title}
      description=""
      hideHeader
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
        {showOperationsLane ? (
          <>
            <div className="min-h-0 xl:col-span-8">
              <div className="flex h-full min-h-0 flex-col gap-5">
                <div className="min-h-0">{heroCard}</div>
                {heroSupplement ? <div className="min-h-0">{heroSupplement}</div> : null}
              </div>
            </div>
            <div className="min-h-0 xl:col-span-4">
              <div className="flex h-full min-h-0 flex-col gap-5">
                {operationsAside ? <div className="min-h-0">{operationsAside}</div> : <div className="min-h-0">{priorityRail}</div>}
                {priorityTrend ? <div className="min-h-0">{priorityTrend}</div> : null}
              </div>
            </div>
            <div className="min-h-0 xl:col-span-12">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                  {copy.recent}
                </div>
                <div className="min-h-0">{recentActivity}</div>
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
                <div className="min-h-0">{leadAnalytics}</div>
              </div>
            </div>
            <div className="min-h-0 xl:col-span-4">{sideAnalytics}</div>
          </>
        ) : null}
        {showWatchLane ? (
          <>
            <div className="min-h-0 xl:col-span-12">
              <div className="min-h-0">{priorityRail}</div>
            </div>
            <div className="min-h-0 xl:col-span-12">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                  {copy.recent}
                </div>
                <div className="min-h-0">{recentActivity}</div>
              </div>
            </div>
          </>
        ) : null}
        {!showOperationsLane && !showDashboardLane && !showWatchLane ? (
          <div className="min-h-0 xl:col-span-12">{heroCard}</div>
        ) : null}
      </div>
    </PageCanvas>
  );
}
