import type { ReactNode } from 'react';
import PageHeader from '../components/common/PageHeader';

interface SettingsPageProps {
  locale: 'ko' | 'en';
  shellCard: ReactNode;
  laneCard: ReactNode;
}

export default function SettingsPage({
  locale,
  shellCard,
  laneCard,
}: SettingsPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Settings',
        title: '설정',
        description: '표시 기준과 현재 연결 상태를 정리합니다.',
      }
    : {
        eyebrow: 'Settings',
        title: 'Settings',
        description: 'Review shell defaults and the current runtime connection state.',
      };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0">{shellCard}</div>
        <div className="min-w-0">{laneCard}</div>
      </div>
    </div>
  );
}
