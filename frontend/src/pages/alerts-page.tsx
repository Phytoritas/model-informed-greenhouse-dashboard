import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface AlertsPageProps {
  locale: 'ko' | 'en';
  surface: ReactNode;
}

export default function AlertsPage({
  locale,
  surface,
}: AlertsPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '긴급 알림',
        description: '긴급 알림, 확인 필요, 처리 이력을 한 화면에서 모읍니다.',
      }
    : {
        eyebrow: 'Alerts',
        title: 'Alerts',
        description: 'Separate urgent response, review, and history in one page.',
      };

  return (
    <PageCanvas
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      hideHeader
    >
      <div className="min-w-0">{surface}</div>
    </PageCanvas>
  );
}
