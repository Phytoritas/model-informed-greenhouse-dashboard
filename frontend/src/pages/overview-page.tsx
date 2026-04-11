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
  const operationsAsideHeightClass = 'xl:h-[430px]';
  const operationsSecondaryRowHeightClass = 'xl:h-[312px]';

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
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5 xl:items-start">
        {showOperationsLane ? (
          <>
            <div className="min-h-0 xl:col-span-3 xl:[&>*]:h-full">{heroCard}</div>
            <div className={`min-h-0 xl:col-span-2 xl:self-start xl:[&>*]:h-full ${operationsAsideHeightClass}`}>
              {operationsAside ?? priorityRail}
            </div>
            {heroSupplement ? (
              <div className={`min-h-0 xl:col-span-3 xl:self-start xl:[&>*]:h-full ${operationsSecondaryRowHeightClass}`}>
                {heroSupplement}
              </div>
            ) : null}
            {priorityTrend ? (
              <div className={`min-h-0 xl:col-span-2 xl:self-start xl:[&>*]:h-full ${operationsSecondaryRowHeightClass}`}>
                {priorityTrend}
              </div>
            ) : null}
            <div className="min-h-0 xl:col-span-5">
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:col-span-5 xl:grid-cols-6">
              {metricDeck}
            </div>
            <div className="min-h-0 xl:col-span-3">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                  {copy.analytics}
                </div>
                <div className="min-h-0">{leadAnalytics}</div>
              </div>
            </div>
            <div className="min-h-0 xl:col-span-2">{sideAnalytics}</div>
          </>
        ) : null}
        {showWatchLane ? (
          <>
            <div className="min-h-0 xl:col-span-5">
              <div className="min-h-0">{priorityRail}</div>
            </div>
            <div className="min-h-0 xl:col-span-5">
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
          <div className="min-h-0 xl:col-span-5">{heroCard}</div>
        ) : null}
      </div>
    </PageCanvas>
  );
}
