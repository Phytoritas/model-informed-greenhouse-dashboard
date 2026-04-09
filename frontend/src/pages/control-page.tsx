import type { ReactNode } from 'react';
import PageHeader from '../components/common/PageHeader';

interface ControlPageProps {
  locale: 'ko' | 'en';
  controlSummary: ReactNode;
  controlActions: ReactNode;
  climateChart: ReactNode;
  watchList: ReactNode;
}

export default function ControlPage({
  locale,
  controlSummary,
  controlActions,
  climateChart,
  watchList,
}: ControlPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Control',
        title: '환경 제어',
        description: '환기, 난방, 냉방, 습도 조치를 따로 정리합니다.',
      }
    : {
        eyebrow: 'Control',
        title: 'Environment control',
        description: 'Keep HVAC, vent, and humidity moves in one dedicated lane.',
      };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <div className="min-w-0">{controlSummary}</div>
        <div className="min-w-0">{controlActions}</div>
      </div>
      <div className="min-w-0">{climateChart}</div>
      <div className="min-w-0">{watchList}</div>
    </div>
  );
}
