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
        eyebrow: '설정',
        title: '설정',
        description: '시뮬레이션 데이터와 실행, 표시 기준, 연결 상태를 한곳에서 관리합니다.',
      }
    : {
        eyebrow: 'Settings',
        title: 'Settings',
        description: 'Manage simulation data and runs, display defaults, and connection state in one place.',
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
