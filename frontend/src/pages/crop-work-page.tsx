import type { ReactNode } from 'react';
import PageHeader from '../components/common/PageHeader';

interface CropWorkPageProps {
  locale: 'ko' | 'en';
  cropSummary: ReactNode;
  workBoard: ReactNode;
  forecastSurface: ReactNode;
  recentWorkSurface: ReactNode;
}

export default function CropWorkPage({
  locale,
  cropSummary,
  workBoard,
  forecastSurface,
  recentWorkSurface,
}: CropWorkPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Crop & Work',
        title: '생육/작업',
        description: '세력, 마디 전개, 착과 부담과 오늘 작업 우선순위를 함께 봅니다.',
      }
    : {
        eyebrow: 'Crop & Work',
        title: 'Crop and work',
        description: 'Read vigor, node pace, load, and today’s labor priorities together.',
      };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.55fr)]">
        <div className="min-w-0">{cropSummary}</div>
        <div className="min-w-0">{workBoard}</div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <div className="min-w-0">{forecastSurface}</div>
        <div className="min-w-0">{recentWorkSurface}</div>
      </div>
    </div>
  );
}
