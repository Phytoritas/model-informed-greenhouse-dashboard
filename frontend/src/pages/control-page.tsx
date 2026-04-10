import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface ControlPageProps {
  locale: 'ko' | 'en';
  strategySurface: ReactNode;
  controlActions: ReactNode;
  controlSummary: ReactNode;
  climateChart: ReactNode;
  watchList: ReactNode;
  tabs?: Array<{ id: string; label: string }>;
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function ControlPage({
  locale,
  strategySurface,
  controlActions,
  controlSummary,
  climateChart,
  watchList,
  tabs = [],
  activeTabId,
  onSelectTab,
}: ControlPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'PhytoSync',
        title: '환경 제어',
        description: '지금 조치, 온도 전략, 장치 상태를 한 화면에 모았습니다.',
      }
    : {
        eyebrow: 'Control',
        title: 'Environment control',
        description: 'Keep HVAC, vent, and humidity moves in one dedicated lane.',
      };

  return (
    <PageCanvas
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{strategySurface}</div>
        <div className="space-y-5 xl:col-span-4">
          <div className="min-h-0 [&>*]:h-full">{controlActions}</div>
          <div className="min-h-0 [&>*]:h-full">{controlSummary}</div>
        </div>
        <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{climateChart}</div>
        <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{watchList}</div>
      </div>
    </PageCanvas>
  );
}
