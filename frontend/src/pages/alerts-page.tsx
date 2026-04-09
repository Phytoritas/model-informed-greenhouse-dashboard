import type { ReactNode } from 'react';
import PageHeader from '../components/common/PageHeader';

interface AlertsPageProps {
  locale: 'ko' | 'en';
  surface: ReactNode;
}

export default function AlertsPage({ locale, surface }: AlertsPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Alerts',
        title: '경보',
        description: '즉시 확인, 오늘 확인, 추적 중을 한 화면에서 모읍니다.',
      }
    : {
        eyebrow: 'Alerts',
        title: 'Alerts',
        description: 'Separate urgent response, review, and history in one page.',
      };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="min-w-0">{surface}</div>
    </div>
  );
}
