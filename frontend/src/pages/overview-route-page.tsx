import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  OverviewSignalsPayload,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  TelemetryStatus,
  WeatherOutlook,
} from '../types';
import type { KpiTileData } from '../components/KpiStrip';
import type { AlertRailItem } from '../components/dashboard/AlertRail';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import AlertRail from '../components/dashboard/AlertRail';
import OverviewSignalTrendCard from '../components/dashboard/OverviewSignalTrendCard';
import {
  LiveMetricStrip,
  OverviewMetricDeck,
  TodayActionBoard,
} from '../components/dashboard/overviewLandingSections';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import { SectionHeader } from '../components/ui/section-header';
import { buildRTRLiveSnapshot, getRtrProfile } from '../utils/rtr';
import { isDecisionRtrWindowUsable } from '../utils/fieldDecisionSupport';
import OverviewPage from './overview-page';
import OverviewPageHeader from '../components/dashboard/OverviewPageHeader';
import PsychrometricDecisionPanel from '../components/dashboard/PsychrometricDecisionPanel';

const Charts = lazy(() => import('../components/Charts'));
const RtrTrendCard = lazy(() => import('../components/dashboard/RtrTrendCard'));

interface OverviewRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  telemetryStatus: TelemetryStatus;
  telemetryDetail: string | null;
  primaryKpiTiles: KpiTileData[];
  secondaryKpiTiles: KpiTileData[];
  runtimeRecommendedAction: string | null;
  heroPrimaryNarrative: string;
  heroSummary: string;
  heroImportantIssue: string | null;
  heroActions: string[];
  confidence: number | null | undefined;
  advisorUpdatedAt?: number | null;
  advisorRefreshing?: boolean;
  modelRuntimeSummary?: string | null;
  sourceSinkBalance?: number | null;
  canopyAssimilation?: number | null;
  lai?: number | null;
  liveSourceSinkSeries?: Array<{
    timestamp: number;
    value: number;
  }>;
  alertItems: AlertRailItem[];
  fallbackAlertBody: string;
  history: SensorData[];
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  overviewSignals: OverviewSignalsPayload | null;
  overviewSignalsLoading: boolean;
  overviewSignalsError: string | null;
  overviewSignalsRefreshedAt?: number | null;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
  produceError: string | null;
  knowledgeSummary: SmartGrowKnowledgeSummary | null;
  knowledgeLoading: boolean;
  knowledgeError: string | null;
  actionsNow: string[];
  actionsToday: string[];
  actionsWeek: string[];
  monitor: string[];
  onOpenRtr: () => void;
  onOpenAdvisor: () => void;
  onOpenAssistant: () => void;
  rtrProfile?: RtrProfile | null;
  activeTabId?: string;
  /** Greenhouse view, owned by the 3D lane and injected by the app root. */
  scene?: ReactNode;
  /** Shared timeline cursor. Drives the charts; the decision board stays on latest. */
  selectedTimestamp?: number | null;
  siteName?: string;
  siteCoordinates?: { latitude: number; longitude: number } | null;
  cropSelector?: ReactNode;
}

export default function OverviewRoutePage({
  locale,
  crop,
  telemetryStatus,
  primaryKpiTiles,
  secondaryKpiTiles,
  alertItems,
  fallbackAlertBody,
  history,
  currentData,
  modelMetrics,
  overviewSignals,
  overviewSignalsLoading,
  overviewSignalsError,
  overviewSignalsRefreshedAt = null,
  actionsNow,
  actionsToday,
  monitor,
  onOpenRtr,
  onOpenAdvisor,
  rtrProfile = null,
  activeTabId,
  scene,
  selectedTimestamp = null,
  siteName,
  siteCoordinates = null,
  cropSelector,
}: OverviewRoutePageProps) {
  const allMetricTiles = [...primaryKpiTiles, ...secondaryKpiTiles];
  // Only show a harvest number the model actually produced. A zero from an
  // unavailable prediction would read as a real forecast of no harvest.
  const yieldPrediction = modelMetrics.yield as { predictedWeekly: number; predictionAvailable?: boolean };
  const yieldOutlookKg = yieldPrediction.predictionAvailable === false
    || !Number.isFinite(yieldPrediction.predictedWeekly)
    ? undefined
    : yieldPrediction.predictedWeekly;
  // Compute the RTR snapshot once so the action board and the comparison card agree.
  const rtrSnapshot = buildRTRLiveSnapshot(
    currentData,
    history.length ? history : [currentData],
    crop,
    rtrProfile,
  );
  const rtrToleranceC = getRtrProfile(crop, rtrProfile).toleranceC;
  const fallbackAlerts = alertItems.length
    ? alertItems
    : [{
        id: 'overview-watch-ready',
        severity: 'resolved' as const,
        title: locale === 'ko' ? '현재 긴급 경보 없음' : 'No urgent alerts',
        body: fallbackAlertBody,
      }];

  return (
    <OverviewPage
      replayNotice={selectedTimestamp !== null ? (
        <p className="overview-replay-note">{locale === 'ko'
          ? '과거 시점을 보고 있습니다. 장면과 그래프는 선택 시각을, 상단 지표와 관리 판단은 최신 값을 표시합니다.'
          : 'Replaying a past moment. The scene and charts use the selected time; top metrics and management decisions use the latest values.'}</p>
      ) : null}
      pageHeader={(
        <OverviewPageHeader
          locale={locale}
          siteName={siteName ?? (locale === 'ko' ? '경북대 온실' : 'KNU greenhouse')}
          siteCoordinates={siteCoordinates}
          // No frames yet means no simulated clock to show, rather than "now".
          simulatedTimestamp={history.length ? currentData.timestamp ?? null : null}
          cropSelector={cropSelector}
        />
      )}
      metricRow={<LiveMetricStrip tiles={[...primaryKpiTiles, ...secondaryKpiTiles]} yieldOutlookKg={yieldOutlookKg} />}
      scene={scene}
      decisionBoard={(
        <TodayActionBoard
          crop={crop}
          currentData={currentData}
          modelMetrics={modelMetrics}
          actionsNow={actionsNow}
          actionsToday={actionsToday}
          monitor={monitor}
          onOpenRtr={onOpenRtr}
          onOpenAdvisor={onOpenAdvisor}
          rtrDeltaC={rtrSnapshot.deltaTempC}
          rtrToleranceC={rtrToleranceC}
          rtrWindowHours={rtrSnapshot.windowHours}
          rtrWindowUsable={isDecisionRtrWindowUsable(history, currentData)}
          telemetryStatus={telemetryStatus}
          receivedAtTimestamp={currentData.receivedAtTimestamp ?? null}
          simulatedTimestamp={history.length ? currentData.timestamp ?? null : null}
          compact={Boolean(scene)}
        />
      )}
      chartRow={(
        // Today stays a decision screen. The full chart board lives once, on
        // Metrics, instead of being duplicated below the scene.
        <a href="#overview-dashboard" className="overview-trend-link">
          <span className="overview-trend-link-text">
            <strong>{locale === 'ko' ? '환경·생육 그래프와 습공기 선도' : 'Climate, crop and moist-air charts'}</strong>
            <span>{locale === 'ko'
              ? '7개 추세와 RTR, 습공기 선도를 지표·추세 탭에서 한 화면으로 봅니다.'
              : 'See all seven trends, RTR and the moist-air chart together on the Metrics tab.'}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
      )}
      dashboardTab={(
        // One composed board: a single page heading, then the metric strip,
        // the chart grid, and the wide panels — each starting at the same left
        // edge, with no per-section header frames in between.
        <div className="overview-metrics-board min-w-0" data-command-surface="overview-dashboard">
          <section className="min-w-0" aria-labelledby="overview-dashboard-metrics-title">
            <SectionHeader
              density="compact"
              title={locale === 'ko' ? '지표와 추세' : 'Metrics and trends'}
              titleId="overview-dashboard-metrics-title"
              description={
                locale === 'ko'
                  ? '전체 지표를 살펴보고 시간에 따른 환경과 작물 반응을 비교하세요.'
                  : 'Explore the full set of metrics and compare environmental and crop responses over time.'
              }
            />
            <OverviewMetricDeck className="mt-3" tiles={allMetricTiles} />
          </section>
          <div className="min-w-0">
            <Suspense
                fallback={(
                  <LoadingSkeleton
                    title={locale === 'ko' ? '실시간 환경 분석' : 'Real-time Environmental Analysis'}
                    loadingMessage={locale === 'ko' ? '실시간 환경 분석 모듈을 불러오는 중...' : 'Loading real-time environmental analysis...'}
                    minHeightClassName="min-h-[304px]"
                  />
                )}
              >
                <Charts
                  data={history}
                  variant="overview"
                  selectedTimestamp={selectedTimestamp}
                  extraChartSlot={(
                    <Suspense
                      fallback={(
                        <LoadingSkeleton
                          title={locale === 'ko' ? 'RTR 추세' : 'RTR trend'}
                          loadingMessage={locale === 'ko' ? 'RTR 추세선을 불러오는 중입니다...' : 'Loading RTR trendline...'}
                          minHeightClassName="min-h-[268px]"
                        />
                      )}
                    >
                      <RtrTrendCard
                        crop={crop}
                        currentData={currentData}
                        history={history}
                        profile={rtrProfile}
                        selectedTimestamp={selectedTimestamp}
                        variant="chart-slot"
                      />
                    </Suspense>
                  )}
                />
            </Suspense>
          </div>
          <PsychrometricDecisionPanel history={history} telemetryStatus={telemetryStatus} selectedTimestamp={selectedTimestamp} />
          <OverviewSignalTrendCard
            signals={overviewSignals}
            loading={overviewSignalsLoading}
            error={overviewSignalsError}
            refreshedAt={overviewSignalsRefreshedAt}
            selectedTimestamp={selectedTimestamp}
            fillHeight={false}
          />
        </div>
      )}
      watchTab={(
        <div className="space-y-4" data-command-surface="overview-watch">
          <AlertRail items={fallbackAlerts} />
        </div>
      )}
      activeTabId={activeTabId}
    />
  );
}
