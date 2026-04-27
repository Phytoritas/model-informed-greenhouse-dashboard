import type { ReactNode } from 'react';
import PageCanvas, { type PageCanvasTab } from '../components/layout/PageCanvas';

interface RtrPageProps {
  locale: 'ko' | 'en';
  recommendationSurface: ReactNode;
  supportSurface?: ReactNode;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function RtrPage({
  locale,
  recommendationSurface,
  supportSurface = null,
  tabs = [],
  activeTabId,
  onSelectTab,
}: RtrPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'RTR',
        title: 'RTR \uCD5C\uC801\uD654',
        description: '\uC624\uB298 \uBAA9\uD45C \uC628\uB3C4\uC640 \uBE44\uAD50\uC548\uC744 \uC815\uB9AC\uD569\uB2C8\uB2E4.',
      }
    : {
        eyebrow: 'RTR',
        title: 'RTR optimization',
        description: 'Compare the recommended lane against the baseline and scenario set.',
      };

  const selectedTabId = activeTabId && tabs.some((tab) => tab.id === activeTabId)
    ? activeTabId
    : (tabs[0]?.id ?? 'rtr-strategy');
  const activeCopy = locale === 'ko'
    ? {
        'rtr-strategy': {
          title: '전략 비교',
          description: '기준안, 최적안, HVAC·환기·스크린 비교를 실제 RTR 최적화 패널에서 확인합니다.',
        },
        'rtr-sensitivity': {
          title: '민감도',
          description: '온도, 환기, 스크린, CO2 조정의 편미분과 시나리오 결과를 같은 연결 패널에서 봅니다.',
        },
        'rtr-area': {
          title: '면적 보정',
          description: '실면적 투영, 제어 상태, 에너지·생육 스냅샷을 면적 기준으로 다시 확인합니다.',
        },
      }
    : {
        'rtr-strategy': {
          title: 'Strategy comparison',
          description: 'Review baseline, optimized, HVAC, vent, and screen comparisons from the live RTR panel.',
        },
        'rtr-sensitivity': {
          title: 'Sensitivity',
          description: 'Read partial-derivative and scenario effects for temperature, vent, screen, and CO2 changes.',
        },
        'rtr-area': {
          title: 'Area projection',
          description: 'Check actual-area projection, control state, and energy/crop snapshots against the area basis.',
        },
      };
  const selectedCopy = activeCopy[selectedTabId as keyof typeof activeCopy] ?? activeCopy['rtr-strategy'];
  const showAreaSupport = selectedTabId === 'rtr-area';

  return (
    <PageCanvas
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      hideHeader
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
    >
      <section
        id={selectedTabId}
        data-testid="rtr-active-panel"
        aria-label={selectedCopy.title}
        tabIndex={-1}
        className="scroll-mt-24 space-y-5 focus:outline-none"
      >
        <div className="sg-warm-panel border border-[color:var(--sg-outline-soft)] px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
            {selectedCopy.title}
          </div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
            {selectedCopy.description}
          </p>
        </div>
        {showAreaSupport && supportSurface ? <div className="min-w-0">{supportSurface}</div> : null}
        <div className="min-w-0">{recommendationSurface}</div>
        {!showAreaSupport && supportSurface ? <div className="min-w-0">{supportSurface}</div> : null}
      </section>
    </PageCanvas>
  );
}
