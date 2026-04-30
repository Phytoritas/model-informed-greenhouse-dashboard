import { Suspense, lazy } from 'react';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  MetricHistoryPoint,
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
import ConsultingTrendCard from '../components/dashboard/ConsultingTrendCard';
import HeroControlCard from '../components/dashboard/HeroControlCard';
import OverviewSignalTrendCard from '../components/dashboard/OverviewSignalTrendCard';
import TodayBoard from '../components/dashboard/TodayBoard';
import {
  FinalCTA,
  HeroDecisionBrief,
  LandingFooter,
  LiveMetricStrip,
  ScenarioOptimizerPreview,
  TodayActionBoard,
  TopNavigation,
  WeatherMarketKnowledgeBridge,
} from '../components/dashboard/overviewLandingSections';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import { MetricCard } from '../components/ui/metric-card';
import { formatMetricValue } from '../utils/formatValue';
import OverviewPage from './overview-page';

const Charts = lazy(() => import('../components/Charts'));
const RtrTrendCard = lazy(() => import('../components/dashboard/RtrTrendCard'));

function getMetricCardTone(tile: KpiTileData): 'normal' | 'warning' | 'critical' | 'muted' {
  if (tile.availabilityState === 'missing') {
    return 'muted';
  }
  if (tile.availabilityState === 'offline') {
    return 'critical';
  }
  if (tile.availabilityState === 'delayed' || tile.availabilityState === 'stale') {
    return 'warning';
  }
  return tile.healthStatus === 'critical'
    ? 'critical'
    : tile.healthStatus === 'warning'
      ? 'warning'
      : 'normal';
}

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
  metricHistory?: MetricHistoryPoint[];
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
}

export default function OverviewRoutePage({
  locale,
  crop,
  telemetryStatus,
  telemetryDetail,
  primaryKpiTiles,
  secondaryKpiTiles,
  runtimeRecommendedAction,
  heroPrimaryNarrative,
  heroSummary,
  heroImportantIssue,
  heroActions,
  confidence,
  advisorUpdatedAt = null,
  advisorRefreshing = false,
  modelRuntimeSummary = null,
  sourceSinkBalance = null,
  canopyAssimilation = null,
  lai = null,
  liveSourceSinkSeries = [],
  alertItems,
  fallbackAlertBody,
  history,
  metricHistory = [],
  currentData,
  modelMetrics,
  overviewSignals,
  overviewSignalsLoading,
  overviewSignalsError,
  overviewSignalsRefreshedAt = null,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  produceLoading,
  produceError,
  knowledgeSummary,
  knowledgeLoading,
  knowledgeError,
  actionsNow,
  actionsToday,
  actionsWeek,
  monitor,
  onOpenRtr,
  onOpenAdvisor,
  onOpenAssistant,
  rtrProfile = null,
  activeTabId,
}: OverviewRoutePageProps) {
  const allMetricTiles = [...primaryKpiTiles, ...secondaryKpiTiles];
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
      topNavigation={<TopNavigation onOpenAssistant={onOpenAssistant} />}
      heroDecisionBrief={(
        <HeroDecisionBrief
          heroCard={(
            <HeroControlCard
              crop={crop}
              operatingMode={runtimeRecommendedAction ?? (locale === 'ko' ? '비교안 준비' : 'Scenario ready')}
              primaryNarrative={heroPrimaryNarrative}
              summary={heroSummary}
              importantIssue={heroImportantIssue}
              actions={heroActions}
              confidence={confidence}
              advisorUpdatedAt={advisorUpdatedAt}
              advisorRefreshing={advisorRefreshing}
              currentData={currentData}
              telemetryStatus={telemetryStatus}
              telemetryDetail={telemetryDetail}
              modelRuntimeSummary={modelRuntimeSummary}
              sourceSinkBalance={sourceSinkBalance}
              canopyAssimilation={canopyAssimilation}
              lai={lai}
              onOpenRtr={onOpenRtr}
              onOpenAdvisor={onOpenAdvisor}
              onOpenAssistant={onOpenAssistant}
            />
          )}
        />
      )}
      liveMetricStrip={(
        <LiveMetricStrip
          tiles={[...primaryKpiTiles, ...secondaryKpiTiles]}
          yieldOutlookKg={modelMetrics.yield.predictedWeekly}
          history={history}
          metricHistory={metricHistory}
        />
      )}
      todayActionBoard={(
        <TodayActionBoard
          crop={crop}
          currentData={currentData}
          modelMetrics={modelMetrics}
          actionsNow={actionsNow}
          actionsToday={actionsToday}
          monitor={monitor}
          onOpenRtr={onOpenRtr}
          onOpenAdvisor={onOpenAdvisor}
        />
      )}
      scenarioOptimizerPreview={(
        <ScenarioOptimizerPreview
          crop={crop}
          currentData={currentData}
          history={history}
          modelMetrics={modelMetrics}
          rtrProfile={rtrProfile}
        />
      )}
      dashboardTab={(
        <div className="space-y-4">
          <section className="space-y-4" aria-labelledby="overview-dashboard-metrics-title">
            <div className="overview-section-heading">
              <div>
                <p className="sg-eyebrow">{locale === 'ko' ? '전체 지표' : 'Dashboard'}</p>
                <h2 id="overview-dashboard-metrics-title">
                  {locale === 'ko' ? '전체 지표와 센서 추세' : 'Full metric deck and sensor trends'}
                </h2>
                <p className="mt-1 max-w-2xl text-[0.8rem] leading-5 text-[color:var(--sg-text-muted)]">
                  {locale === 'ko'
                    ? '첫 화면에서는 요약만 보이고, 상세 지표와 환경 차트는 이 탭에서 같은 데이터 흐름으로 확인합니다.'
                    : 'Command stays summary-first; detailed metrics and environmental charts remain connected here.'}
                </p>
              </div>
            </div>
            <div className="overview-card-row-4">
              {allMetricTiles.map((tile) => {
                const isNumeric = typeof tile.value === 'number';
                const tone = getMetricCardTone(tile);
                return (
                  <MetricCard
                    key={tile.key}
                    label={tile.label}
                    value={isNumeric ? formatMetricValue(Number(tile.value), tile.fractionDigits) : String(tile.value)}
                    unit={isNumeric && tile.availabilityState !== 'missing' ? tile.unit : undefined}
                    detail={tile.lastReceived ?? tile.availabilityLabel}
                    trend={tile.trend}
                    trendLabel={tile.trendDetail || tile.availabilityLabel}
                    icon={tile.icon}
                    tone={tone}
                  />
                );
              })}
            </div>
          </section>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
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
                  extraChartSlot={(
                    <Suspense
                      fallback={(
                        <LoadingSkeleton
                          title={locale === 'ko' ? '온도 기준 추세' : 'RTR trend'}
                          loadingMessage={locale === 'ko' ? '온도 기준 추세선을 불러오는 중입니다...' : 'Loading RTR trendline...'}
                          minHeightClassName="min-h-[268px]"
                        />
                      )}
                    >
                      <RtrTrendCard
                        crop={crop}
                        currentData={currentData}
                        history={history}
                        profile={rtrProfile}
                        variant="chart-slot"
                      />
                    </Suspense>
                  )}
                />
              </Suspense>
            </div>
            <div className="space-y-4 xl:col-span-5">
              <OverviewSignalTrendCard
                signals={overviewSignals}
                loading={overviewSignalsLoading}
                error={overviewSignalsError}
                refreshedAt={overviewSignalsRefreshedAt}
                fillHeight={false}
                liveSourceSinkSeries={liveSourceSinkSeries}
              />
              <ConsultingTrendCard
                actionsNow={actionsNow}
                actionsToday={actionsToday}
                actionsWeek={actionsWeek}
                confidence={confidence}
                advisorRefreshing={advisorRefreshing}
                advisorUpdatedAt={advisorUpdatedAt}
              />
            </div>
          </div>
        </div>
      )}
      watchTab={(
        <div className="space-y-4">
          <AlertRail items={fallbackAlerts} />
          <TodayBoard
            actionsNow={actionsNow}
            actionsToday={actionsToday}
            actionsWeek={actionsWeek}
            monitor={monitor}
            advisorUpdatedAt={advisorUpdatedAt}
            advisorRefreshing={advisorRefreshing}
          />
        </div>
      )}
      weatherMarketKnowledgeBridge={(
        <WeatherMarketKnowledgeBridge
          crop={crop}
          weather={weather}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          producePrices={producePrices}
          produceLoading={produceLoading}
          produceError={produceError}
          knowledgeSummary={knowledgeSummary}
          knowledgeLoading={knowledgeLoading}
          knowledgeError={knowledgeError}
          history={history}
          onOpenAssistant={onOpenAssistant}
        />
      )}
      finalCta={<FinalCTA />}
      footer={<LandingFooter onOpenAssistant={onOpenAssistant} />}
      activeTabId={activeTabId}
    />
  );
}
