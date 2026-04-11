import { Suspense, lazy } from 'react';
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
import AlertRail from '../components/dashboard/AlertRail';
import CompactMetricDeck from '../components/dashboard/CompactMetricDeck';
import DecisionSnapshotGrid from '../components/dashboard/DecisionSnapshotGrid';
import HeroControlCard from '../components/dashboard/HeroControlCard';
import OverviewPhotoCollageCard from '../components/dashboard/OverviewPhotoCollageCard';
import OverviewSignalTrendCard from '../components/dashboard/OverviewSignalTrendCard';
import TodayBoard from '../components/dashboard/TodayBoard';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import OverviewPage from './overview-page';

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
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
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
  currentData,
  modelMetrics,
  overviewSignals,
  overviewSignalsLoading,
  overviewSignalsError,
  weather,
  weatherLoading,
  producePrices,
  produceLoading,
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
  const fallbackAlerts = alertItems.length
    ? alertItems
    : [{
        id: 'ready',
        severity: 'resolved' as const,
        title: locale === 'ko' ? '지금 바로 조치할 항목 없음' : 'No active critical alert',
        body: fallbackAlertBody,
      }];

  return (
    <OverviewPage
      locale={locale}
      activeTabId={activeTabId}
      metricDeck={<CompactMetricDeck tiles={[...primaryKpiTiles, ...secondaryKpiTiles]} />}
      heroCard={(
        <HeroControlCard
          operatingMode={runtimeRecommendedAction ?? (locale === 'ko' ? '비교안 준비' : 'Scenario ready')}
          primaryNarrative={heroPrimaryNarrative}
          summary={heroSummary}
          importantIssue={heroImportantIssue}
          actions={heroActions}
          confidence={confidence}
          advisorUpdatedAt={advisorUpdatedAt}
          advisorRefreshing={advisorRefreshing}
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
      heroSupplement={<OverviewPhotoCollageCard />}
      operationsAside={(
        <OverviewSignalTrendCard
          signals={overviewSignals}
          loading={overviewSignalsLoading}
          error={overviewSignalsError}
          liveSourceSinkSeries={liveSourceSinkSeries}
        />
      )}
      priorityRail={<AlertRail items={fallbackAlerts} compact />}
      priorityTrend={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? 'RTR 추세' : 'RTR trend'}
              loadingMessage={locale === 'ko' ? 'RTR 추세선을 불러오는 중입니다...' : 'Loading RTR trendline...'}
              minHeightClassName="h-[312px]"
            />
          )}
        >
          <RtrTrendCard
            crop={crop}
            currentData={currentData}
            history={history}
            profile={rtrProfile}
          />
        </Suspense>
      )}
      leadAnalytics={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '실시간 환경 분석' : 'Real-time Environmental Analysis'}
              loadingMessage={locale === 'ko' ? '실시간 환경 분석 모듈을 불러오는 중...' : 'Loading real-time environmental analysis...'}
              minHeightClassName="min-h-[304px]"
            />
          )}
        >
          <Charts data={history} variant="overview" />
        </Suspense>
      )}
      sideAnalytics={(
        <DecisionSnapshotGrid
          crop={crop}
          currentData={currentData}
          modelMetrics={modelMetrics}
          weather={weather}
          weatherLoading={weatherLoading}
          producePrices={producePrices}
          produceLoading={produceLoading}
          history={history}
        />
      )}
      recentActivity={(
        <TodayBoard
          actionsNow={actionsNow}
          actionsToday={actionsToday}
          actionsWeek={actionsWeek}
          monitor={monitor}
          advisorUpdatedAt={advisorUpdatedAt}
          advisorRefreshing={advisorRefreshing}
        />
      )}
    />
  );
}
