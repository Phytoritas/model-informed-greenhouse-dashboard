import type { ReactNode } from 'react';
import PageHeader from '../components/common/PageHeader';

interface OverviewPageProps {
  locale: 'ko' | 'en';
  kpiBand: ReactNode;
  heroCard: ReactNode;
  priorityRail: ReactNode;
  leadAnalytics: ReactNode;
  sideAnalytics: ReactNode;
  recentActivity: ReactNode;
}

export default function OverviewPage({
  locale,
  kpiBand,
  heroCard,
  priorityRail,
  leadAnalytics,
  sideAnalytics,
  recentActivity,
}: OverviewPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Overview',
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
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      {kpiBand}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <div className="min-w-0">{heroCard}</div>
        <div className="min-w-0">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
            {copy.priority}
          </div>
          {priorityRail}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <div className="min-w-0">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
            {copy.analytics}
          </div>
          {leadAnalytics}
        </div>
        <div className="min-w-0">{sideAnalytics}</div>
      </div>
      <div className="min-w-0">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
          {copy.recent}
        </div>
        {recentActivity}
      </div>
    </div>
  );
}
