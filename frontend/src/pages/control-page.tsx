import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

export type ControlPagePanelId = 'control-strategy' | 'control-devices';

interface ControlPageProps {
  locale: 'ko' | 'en';
  activePanel: ControlPagePanelId;
  strategySurface: ReactNode;
  controlActions: ReactNode;
  controlSummary: ReactNode;
  environmentAdvisorSurface?: ReactNode;
  runtimeSurface?: ReactNode;
}

export default function ControlPage({
  locale,
  activePanel,
  strategySurface,
  controlActions,
  controlSummary,
  environmentAdvisorSurface = null,
  runtimeSurface,
}: ControlPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '온실 환경',
        description: '',
      }
    : {
        eyebrow: 'PhytoSync',
        title: 'Climate Solutions',
        description: '',
      };

  return (
    <PageCanvas
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      hideHeader
    >
      {activePanel === 'control-strategy' ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {runtimeSurface ? <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{runtimeSurface}</div> : null}
          <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{controlActions}</div>
          <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{strategySurface}</div>
          <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{controlSummary}</div>
          {environmentAdvisorSurface ? <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{environmentAdvisorSurface}</div> : null}
        </div>
      ) : null}
      {activePanel === 'control-devices' ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {runtimeSurface ? <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{runtimeSurface}</div> : null}
          <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{controlSummary}</div>
          <div className="min-h-0 xl:col-span-12 [&>*]:h-full">{controlActions}</div>
        </div>
      ) : null}
    </PageCanvas>
  );
}
