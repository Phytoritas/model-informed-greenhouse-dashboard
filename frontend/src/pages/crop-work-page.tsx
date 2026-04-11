import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface CropWorkPageProps {
  locale: 'ko' | 'en';
  cropSummary: ReactNode;
  workBoard: ReactNode;
  forecastSurface: ReactNode;
  recentWorkSurface: ReactNode;
  activeTabId?: string;
}

export default function CropWorkPage({
  locale,
  cropSummary,
  workBoard,
  forecastSurface,
  recentWorkSurface,
  activeTabId,
}: CropWorkPageProps) {
  const selectedTabId = activeTabId ?? 'crop-work-growth';
  const showGrowth = selectedTabId === 'crop-work-growth';
  const showWork = selectedTabId === 'crop-work-work';
  const showHarvest = selectedTabId === 'crop-work-harvest';

  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '작물 상태 및 농작업',
        description: '세력, 마디 전개, 착과 부담과 오늘 작업 우선순위를 함께 봅니다.',
      }
    : {
        eyebrow: 'Crop & Work',
        title: 'Crop and work',
        description: 'Read vigor, node pace, load, and today’s labor priorities together.',
      };

  return (
    <PageCanvas
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      hideHeader
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {showGrowth ? (
          <>
            <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{cropSummary}</div>
            <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{workBoard}</div>
            <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{forecastSurface}</div>
          </>
        ) : null}
        {showWork ? (
          <>
            <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{workBoard}</div>
            <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{recentWorkSurface}</div>
            <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{cropSummary}</div>
          </>
        ) : null}
        {showHarvest ? (
          <>
            <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{recentWorkSurface}</div>
            <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{workBoard}</div>
            <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{forecastSurface}</div>
          </>
        ) : null}
        {!showGrowth && !showWork && !showHarvest ? (
          <>
            <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{cropSummary}</div>
            <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{workBoard}</div>
            <div className="min-h-0 xl:col-span-6 [&>*]:h-full">{forecastSurface}</div>
            <div className="min-h-0 xl:col-span-6 [&>*]:h-full">{recentWorkSurface}</div>
          </>
        ) : null}
      </div>
    </PageCanvas>
  );
}
