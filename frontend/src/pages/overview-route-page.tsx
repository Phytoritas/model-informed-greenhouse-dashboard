import { Suspense, lazy } from 'react';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  ProducePricesPayload,
  SensorData,
  TelemetryStatus,
  WeatherOutlook,
} from '../types';
import type { KpiTileData } from '../components/KpiStrip';
import type { AlertRailItem } from '../components/dashboard/AlertRail';
import AlertRail from '../components/dashboard/AlertRail';
import DecisionSnapshotGrid from '../components/dashboard/DecisionSnapshotGrid';
import HeroControlCard from '../components/dashboard/HeroControlCard';
import LiveMetricStrip from '../components/dashboard/LiveMetricStrip';
import TodayBoard from '../components/dashboard/TodayBoard';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import OverviewPage from './overview-page';

const Charts = lazy(() => import('../components/Charts'));

interface OverviewRoutePageProps {
  locale: AppLocale;
  telemetryStatus: TelemetryStatus;
  telemetryDetail: string | null;
  kpiStatusSummary: string;
  primaryKpiTiles: KpiTileData[];
  secondaryKpiTiles: KpiTileData[];
  runtimeRecommendedAction: string | null;
  heroPrimaryNarrative: string;
  heroSummary: string;
  heroImportantIssue: string | null;
  heroActions: string[];
  confidence: number | null | undefined;
  modelRuntimeSummary?: string | null;
  sourceSinkBalance?: number | null;
  canopyAssimilation?: number | null;
  lai?: number | null;
  alertItems: AlertRailItem[];
  fallbackAlertBody: string;
  history: SensorData[];
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
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
}

export default function OverviewRoutePage({
  locale,
  telemetryStatus,
  telemetryDetail,
  kpiStatusSummary,
  primaryKpiTiles,
  secondaryKpiTiles,
  runtimeRecommendedAction,
  heroPrimaryNarrative,
  heroSummary,
  heroImportantIssue,
  heroActions,
  confidence,
  modelRuntimeSummary = null,
  sourceSinkBalance = null,
  canopyAssimilation = null,
  lai = null,
  alertItems,
  fallbackAlertBody,
  history,
  currentData,
  modelMetrics,
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
      kpiBand={(
        <LiveMetricStrip
          statusSummary={kpiStatusSummary}
          telemetryStatus={telemetryStatus}
          primaryTiles={primaryKpiTiles}
          secondaryTiles={secondaryKpiTiles}
        />
      )}
      heroCard={(
        <HeroControlCard
          operatingMode={runtimeRecommendedAction ?? (locale === 'ko' ? '비교안 준비' : 'Scenario ready')}
          primaryNarrative={heroPrimaryNarrative}
          summary={heroSummary}
          importantIssue={heroImportantIssue}
          actions={heroActions}
          confidence={confidence}
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
      priorityRail={<AlertRail items={fallbackAlerts} />}
      leadAnalytics={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '실시간 환경 분석' : 'Real-time Environmental Analysis'}
              loadingMessage={locale === 'ko' ? '실시간 환경 분석 모듈을 불러오는 중...' : 'Loading real-time environmental analysis...'}
              minHeightClassName="min-h-[520px]"
            />
          )}
        >
          <Charts data={history} />
        </Suspense>
      )}
      sideAnalytics={(
        <DecisionSnapshotGrid
          currentData={currentData}
          modelMetrics={modelMetrics}
          weather={weather}
          weatherLoading={weatherLoading}
          producePrices={producePrices}
          produceLoading={produceLoading}
        />
      )}
      recentActivity={(
        <TodayBoard
          actionsNow={actionsNow}
          actionsToday={actionsToday}
          actionsWeek={actionsWeek}
          monitor={monitor}
        />
      )}
    />
  );
}
