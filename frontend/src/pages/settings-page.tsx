import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

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
        eyebrow: 'Contact',
        title: '연결 상태와 운영 설정',
        description: '센서·날씨·시세 연결 상태, 작물별 가격/전력 단가, 운영 기본값을 확인합니다.',
      }
    : {
        eyebrow: 'Contact',
        title: 'Settings',
        description: 'Review service connectivity, crop-specific price/cost assumptions, and operating defaults.',
      };

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0">{shellCard}</div>
        <div className="min-w-0">{laneCard}</div>
      </div>
    </PageCanvas>
  );
}
