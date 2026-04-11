import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface ControlPageProps {
  locale: 'ko' | 'en';
  strategySurface: ReactNode;
  controlActions: ReactNode;
  controlSummary: ReactNode;
}

export default function ControlPage({
  locale,
  strategySurface,
  controlActions,
  controlSummary,
}: ControlPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '온실 환경',
        description: '',
      }
    : {
        eyebrow: 'PhytoSync',
        title: 'Control Solutions',
        description: '',
      };

  return (
    <PageCanvas
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      hideHeader
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{strategySurface}</div>
        <div className="grid gap-5 lg:grid-cols-2 xl:col-span-12">
          <div className="min-h-0 [&>*]:h-full">{controlActions}</div>
          <div className="min-h-0 [&>*]:h-full">{controlSummary}</div>
        </div>
      </div>
    </PageCanvas>
  );
}
