import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface SettingsPageProps {
  locale: 'ko' | 'en';
  shellCard: ReactNode;
  laneCard: ReactNode;
  runtimeSurface: ReactNode;
}

export default function SettingsPage({
  locale,
  shellCard,
  laneCard,
  runtimeSurface,
}: SettingsPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '설정',
        description: '표시 기준과 현재 연결 상태를 정리합니다.',
      }
    : {
        eyebrow: 'PhytoSync',
        title: 'Settings',
        description: 'Review shell defaults and the current runtime connection state.',
      };

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <div className="mb-6 min-w-0">{runtimeSurface}</div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">{shellCard}</div>
        <div className="min-w-0">{laneCard}</div>
      </div>
    </PageCanvas>
  );
}
