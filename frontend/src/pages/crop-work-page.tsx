import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface CropWorkPageProps {
  locale: 'ko' | 'en';
  cropSummary: ReactNode;
  workBoard: ReactNode;
  forecastSurface: ReactNode;
  recentWorkSurface: ReactNode;
  tabs?: Array<{ id: string; label: string }>;
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function CropWorkPage({
  locale,
  cropSummary,
  workBoard,
  forecastSurface,
  recentWorkSurface,
  tabs = [],
  activeTabId,
  onSelectTab,
}: CropWorkPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '생육작업',
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
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{cropSummary}</div>
        <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{workBoard}</div>
        <div className="min-h-0 xl:col-span-6 [&>*]:h-full">{forecastSurface}</div>
        <div className="min-h-0 xl:col-span-6 [&>*]:h-full">{recentWorkSurface}</div>
      </div>
    </PageCanvas>
  );
}
