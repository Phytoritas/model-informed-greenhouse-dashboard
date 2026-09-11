import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import PageCanvas from '../components/layout/PageCanvas';
import { ToggleGroup } from '../components/ui/toggle-group';
import { useLocale } from '../i18n/LocaleProvider';
import { cn } from '../utils/cn';
import '../styles/overview-workspace.css';

interface OverviewPageProps {
  topNavigation?: ReactNode;
  /** Compact page context: site, demo badge, simulated time, crop selector. */
  pageHeader?: ReactNode;
  metricRow: ReactNode;
  /** Greenhouse view. Owned by the 3D lane and injected by the app root. */
  scene?: ReactNode;
  /** The single decision surface for this screen. */
  decisionBoard: ReactNode;
  chartRow?: ReactNode;
  dashboardTab?: ReactNode;
  watchTab?: ReactNode;
  activeTabId?: string;
  replayNotice?: ReactNode;
}

const OVERVIEW_SECTION_BY_ACTION: Record<string, string> = {
  'overview-core': 'overview-core',
  'overview-dashboard': 'overview-dashboard',
  'overview-watch': 'overview-watch',
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
  pageHeader,
  metricRow,
  scene,
  decisionBoard,
  chartRow,
  dashboardTab,
  watchTab,
  activeTabId,
  replayNotice,
}: OverviewPageProps) {
  const location = useLocation();
  const { locale } = useLocale();
  const activeTab = normalizeOverviewTab(activeTabId);
  const tabs = locale === 'ko'
    ? [
        { id: 'overview-core' as const, label: '오늘의 온실', description: '지금 상태와 할 일' },
        { id: 'overview-dashboard' as const, label: '지표·추세', description: '자세한 값과 그래프' },
        { id: 'overview-watch' as const, label: '경보·상태', description: '경보와 시뮬레이션 상태' },
      ]
    : [
        { id: 'overview-core' as const, label: 'Today', description: 'Current state and next checks' },
        { id: 'overview-dashboard' as const, label: 'Metrics', description: 'Detailed values and charts' },
        { id: 'overview-watch' as const, label: 'Alerts', description: 'Alerts and simulation status' },
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
          <div className="overview-frame-body overview-workspace">
            {topNavigation}
            {pageHeader}
            <ToggleGroup className="overview-tab-strip" role="tablist" aria-label={locale === 'ko' ? '온실 화면 탭' : 'Overview tabs'}>
              {tabs.map((tab) => (
                <a
                  key={tab.id}
                  id={`${tab.id}-tab`}
                  href={`#${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  // Core renders a wrapper panel; the other two render the section itself.
                  aria-controls={tab.id === 'overview-core' ? 'overview-core-panel' : tab.id}
                  className={cn('overview-tab-link', activeTab === tab.id && 'overview-tab-link-active')}
                >
                  <span>{tab.label}</span>
                  <small>{tab.description}</small>
                </a>
              ))}
            </ToggleGroup>
            {activeTab === 'overview-core' ? (
              <div id="overview-core-panel" role="tabpanel" aria-labelledby="overview-core-tab" className="overview-tab-panel">
                <section id="overview-core" tabIndex={-1} className="scroll-mt-24 space-y-3">
                  {metricRow}
                  {replayNotice}
                  <div className={cn('overview-decision-layout', !scene && 'overview-decision-layout-solo')}>
                    {scene ? <div className="overview-scene-column">{scene}</div> : null}
                    <div className="overview-decision-column">{decisionBoard}</div>
                  </div>
                  {chartRow}
                </section>
              </div>
            ) : null}
            {activeTab === 'overview-dashboard' ? (
              <section id="overview-dashboard" tabIndex={-1} role="tabpanel" className="overview-tab-panel scroll-mt-24" aria-labelledby="overview-dashboard-tab">
                {dashboardTab ?? metricRow}
              </section>
            ) : null}
            {activeTab === 'overview-watch' ? (
              <section id="overview-watch" tabIndex={-1} role="tabpanel" className="overview-tab-panel scroll-mt-24" aria-labelledby="overview-watch-tab">
                {watchTab}
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </PageCanvas>
  );
}
