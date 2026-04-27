import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface SettingsPageProps {
  locale: 'ko' | 'en';
  shellCard: ReactNode;
  laneCard: ReactNode;
  supportCard?: ReactNode;
}

export default function SettingsPage({
  locale,
  shellCard,
  laneCard,
  supportCard,
}: SettingsPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Contact',
        title: '연동 상태와 운영 문의',
        description: '센서·날씨·시세 연결, 작물별 비용 기준, 운영 중 확인할 연락·지원 정보를 정리합니다.',
      }
    : {
        eyebrow: 'Contact',
        title: 'Connectivity and support',
        description: 'Review service links, crop-specific cost assumptions, and support-ready operating details.',
      };

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0">{shellCard}</div>
        <div className="min-w-0">{laneCard}</div>
        {supportCard ? <div className="min-w-0 xl:col-span-2">{supportCard}</div> : null}
      </div>
    </PageCanvas>
  );
}
