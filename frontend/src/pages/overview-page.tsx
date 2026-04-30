import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import PageCanvas from '../components/layout/PageCanvas';
import { useLocale } from '../i18n/LocaleProvider';
import { cn } from '../utils/cn';

interface OverviewPageProps {
  topNavigation: ReactNode;
  heroDecisionBrief: ReactNode;
  liveMetricStrip: ReactNode;
  todayActionBoard: ReactNode;
  scenarioOptimizerPreview: ReactNode;
  weatherMarketKnowledgeBridge: ReactNode;
  finalCta: ReactNode;
  footer: ReactNode;
  dashboardTab?: ReactNode;
  watchTab?: ReactNode;
  activeTabId?: string;
}

const OVERVIEW_SECTION_BY_ACTION: Record<string, string> = {
  'overview-core': 'overview-core',
  'overview-dashboard': 'overview-dashboard',
  'overview-watch': 'overview-watch',
  'scenario-optimizer': 'scenario-optimizer',
  'runtime-bridge': 'runtime-bridge',
  'backend-runtime-bridge': 'runtime-bridge',
  'live-overview': 'live-overview',
  'today-action-board': 'today-action-board',
};

const OVERVIEW_TAB_IDS = ['overview-core', 'overview-dashboard', 'overview-watch'] as const;
type OverviewTabId = typeof OVERVIEW_TAB_IDS[number];

function normalizeOverviewTab(tabId: string | undefined): OverviewTabId {
  return OVERVIEW_TAB_IDS.includes(tabId as OverviewTabId)
    ? (tabId as OverviewTabId)
    : 'overview-core';
}

export default function OverviewPage({
  topNavigation,
  heroDecisionBrief,
  liveMetricStrip,
  todayActionBoard,
  scenarioOptimizerPreview,
  weatherMarketKnowledgeBridge,
  finalCta,
  footer,
  dashboardTab,
  watchTab,
  activeTabId,
}: OverviewPageProps) {
  const location = useLocation();
  const { locale } = useLocale();
  const activeTab = normalizeOverviewTab(activeTabId);
  const tabs = locale === 'ko'
    ? [
        { id: 'overview-core' as const, label: '오늘 판단', description: '오늘 의사결정 요약' },
        { id: 'overview-dashboard' as const, label: '전체 지표', description: '센서와 추세' },
        { id: 'overview-watch' as const, label: '주의 확인', description: '경보와 확인 항목' },
      ]
    : [
        { id: 'overview-core' as const, label: 'Command', description: 'Decision brief' },
        { id: 'overview-dashboard' as const, label: 'Dashboard', description: 'Metrics and trends' },
        { id: 'overview-watch' as const, label: 'Watch', description: 'Alerts and runtime state' },
      ];

  useEffect(() => {
    const rawHash = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
    const activeTargetId = activeTabId && activeTabId !== 'overview-core'
      ? OVERVIEW_SECTION_BY_ACTION[activeTabId]
      : null;
    const targetId = rawHash ? OVERVIEW_SECTION_BY_ACTION[rawHash] : activeTargetId;

    if (!targetId) {
      return;
    }

    const scheduleFrame = window.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;
    const frame = scheduleFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      if (typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    });

    return () => cancelFrame(frame);
  }, [activeTabId, location.hash]);

  return (
    <PageCanvas title="PhytoSync" description="" hideHeader>
      <main className="overview-browser-shell">
        <div className="overview-browser-frame">
          <div className="overview-frame-body">
            {topNavigation}
            <nav className="overview-tab-strip" aria-label={locale === 'ko' ? '오늘 운영 세부 탭' : 'Overview tabs'}>
              {tabs.map((tab) => (
                <a
                  key={tab.id}
                  id={`${tab.id}-tab`}
                  href={`#${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${tab.id}-panel`}
                  className={cn('overview-tab-link', activeTab === tab.id && 'overview-tab-link-active')}
                >
                  <span>{tab.label}</span>
                  <small>{tab.description}</small>
                </a>
              ))}
            </nav>
            {activeTab === 'overview-core' ? (
              <div id="overview-core-panel" role="tabpanel" aria-labelledby="overview-core-tab" className="overview-tab-panel">
                {heroDecisionBrief}
                {liveMetricStrip}
                {todayActionBoard}
                {scenarioOptimizerPreview}
                {weatherMarketKnowledgeBridge}
                {finalCta}
                {footer}
              </div>
            ) : null}
            {activeTab === 'overview-dashboard' ? (
              <section id="overview-dashboard" tabIndex={-1} role="tabpanel" className="overview-tab-panel scroll-mt-24" aria-labelledby="overview-dashboard-tab">
                {dashboardTab ?? (
                  <>
                    {liveMetricStrip}
                  </>
                )}
              </section>
            ) : null}
            {activeTab === 'overview-watch' ? (
              <section id="overview-watch" tabIndex={-1} role="tabpanel" className="overview-tab-panel scroll-mt-24" aria-labelledby="overview-watch-tab">
                {watchTab ?? todayActionBoard}
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </PageCanvas>
  );
}
