import { Suspense, lazy } from 'react';
import { AlertTriangle, Bell, History, ShieldCheck } from 'lucide-react';
import type { KpiTileData } from '../components/KpiStrip';
import type { AlertRailItem } from '../components/dashboard/AlertRail';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
} from '../components/dashboard/FeatureLandingFrame';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import { useAlertHistory } from '../hooks/useAlertHistory';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  TelemetryStatus,
  WeatherOutlook,
} from '../types';
import { appendFiniteValue, mapNumericSeries, pickNumericSeries } from '../utils/metricTrendSeries';

const AlertsCommandCenter = lazy(() => import('../components/alerts/AlertsCommandCenter'));

interface AlertsRoutePageProps {
  locale: AppLocale;
  items: AlertRailItem[];
  fallbackAlertBody: string;
  crop: CropType;
  summary?: SmartGrowKnowledgeSummary | null;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
  history?: SensorData[];
  forecast?: ForecastData | null;
  producePrices?: ProducePricesPayload | null;
  weather?: WeatherOutlook | null;
  rtrProfile?: RtrProfile | null;
  telemetryStatus: TelemetryStatus;
  statusSummary: string;
  primaryTiles: KpiTileData[];
  secondaryTiles: KpiTileData[];
  activePanel?: 'alerts-protection' | 'alerts-warning' | 'alerts-history';
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
  onOpenAssistant: () => void;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function AlertsRoutePage({
  locale,
  items,
  fallbackAlertBody,
  crop,
  summary = null,
  currentData,
  metrics,
  history = [],
  forecast = null,
  producePrices = null,
  weather = null,
  rtrProfile = null,
  telemetryStatus,
  statusSummary,
  primaryTiles,
  secondaryTiles,
  activePanel = 'alerts-protection',
  tabs = [],
  activeTabId,
  onSelectTab,
  onOpenAssistant,
}: AlertsRoutePageProps) {
  const fallbackItems = items.length
    ? items
    : [{
        id: 'ready',
        severity: 'resolved' as const,
        title: locale === 'ko' ? '지금 바로 조치할 긴급 알림 없음' : 'No active critical alert',
        body: fallbackAlertBody,
      }];
  const alertHistory = useAlertHistory(crop, fallbackItems);
  const activeSurfaceId = activeTabId ?? activePanel;
  const criticalCount = fallbackItems.filter((item) => item.severity === 'critical').length;
  const warningCount = fallbackItems.filter((item) => item.severity === 'warning').length;
  const resolvedCount = alertHistory.events.filter((item) => item.severity === 'resolved').length;
  const protectionReady = Boolean(summary?.surfaces.some((surface) => surface.key === 'pesticide' && surface.status === 'ready'));
  const alertTrendValues = [
    criticalCount,
    warningCount,
    fallbackItems.length,
    alertHistory.events.length,
    primaryTiles.length,
    secondaryTiles.length,
    resolvedCount,
  ];
  const criticalSeries = appendFiniteValue(
    mapNumericSeries(alertHistory.events, (event) => (event.severity === 'critical' ? 1 : 0), 24),
    criticalCount,
    24,
  );
  const warningSeries = appendFiniteValue(
    mapNumericSeries(alertHistory.events, (event) => (event.severity === 'warning' ? 1 : 0), 24),
    warningCount,
    24,
  );
  const copy = locale === 'ko'
    ? {
        title: '방제·알림',
        description: '농약 솔루션, 확인 필요 알림, 처리 이력을 같은 기준으로 봅니다.',
        heroBadge: '방제·알림 의사결정',
        heroTitle: '오이 병해충과 알림을 단계별로 처리합니다',
        heroBody: '흰가루병, 가루이, 노균병, 나방류 타깃을 선택하고 처리 이력과 위험도를 함께 확인합니다.',
        primary: '농약 솔루션',
        secondary: '처리 이력',
        live: '방제·알림 요약',
        freshness: '알림·농약·처리 이력 연결됨',
        actionsEyebrow: '방제 전 확인',
        actionsTitle: '방제와 알림 처리 전에 볼 4가지',
        comparisonEyebrow: '위험 검토',
        comparisonTitle: '현재 위험과 처리 준비 상태 비교',
        comparisonStatus: '연결됨',
        bridgeEyebrow: '농약 · 주의 · 이력',
        bridgeTitle: '위험 판단 요약',
        detailEyebrow: '세부 기능',
        detailTitle: '농약 솔루션·주의·처리 이력',
        detailDescription: '농약 솔루션, 확인 필요 항목, 처리 이력을 세부 탭으로 나눠 확인합니다.',
        open: '열기',
      }
    : {
        title: 'Protection',
        description: 'Review pesticide solutions, warnings, and handling history with the same product frame.',
        heroBadge: 'Protection decision lane',
        heroTitle: 'Handle cucumber pest risk and alerts step by step',
        heroBody: 'Select mildew, whitefly, downy mildew, and moth targets while checking risk and handling history.',
        primary: 'Pesticide solution',
        secondary: 'History',
        live: 'Protection Live Overview',
        freshness: 'alerts · pesticide · history APIs connected',
        actionsEyebrow: 'Protection Action Board',
        actionsTitle: 'Four checks before protection work',
        comparisonEyebrow: 'Risk Review',
        comparisonTitle: 'Current risk vs handling readiness',
        comparisonStatus: 'connected',
        bridgeEyebrow: 'Pesticide · Watch · History',
        bridgeTitle: 'Risk summary',
        detailEyebrow: 'PROTECTION FULL SURFACES',
        detailTitle: 'Pesticide solution, watch queue, and history',
        detailDescription: 'Pesticide solutions and alert history remain available below inside the PNG-style frame.',
        open: 'Open',
      };
  const featureMetrics: FeatureMetric[] = [
    {
      label: locale === 'ko' ? '긴급' : 'Critical',
      value: `${criticalCount}`,
      detail: locale === 'ko' ? '즉시 확인' : 'immediate review',
      trendLabel: locale === 'ko' ? '위험' : 'risk',
      icon: AlertTriangle,
      tone: criticalCount ? 'critical' : 'muted',
      series: criticalSeries,
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '긴급 위험 이력' : 'Critical risk history',
    },
    {
      label: locale === 'ko' ? '주의' : 'Warning',
      value: `${warningCount}`,
      detail: locale === 'ko' ? '주의 항목' : 'watch items',
      trendLabel: locale === 'ko' ? '확인' : 'watch',
      icon: Bell,
      tone: warningCount ? 'warning' : 'normal',
      series: warningSeries,
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '주의 위험 이력' : 'Warning risk history',
    },
    {
      label: locale === 'ko' ? '이력' : 'History',
      value: `${alertHistory.events.length}`,
      detail: locale === 'ko' ? '처리 이력' : '/api/alerts/history',
      trendLabel: alertHistory.loading ? (locale === 'ko' ? '불러오는 중' : 'loading') : (locale === 'ko' ? '저장됨' : 'stored'),
      icon: History,
      tone: alertHistory.error ? 'warning' : 'normal',
      series: mapNumericSeries(alertHistory.events, (_event, index) => index + 1, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '알림 이력 누적' : 'Alert history accumulation',
    },
    {
      label: locale === 'ko' ? '농약' : 'Protection',
      value: locale === 'ko' ? (protectionReady ? '준비됨' : '검토') : (protectionReady ? 'Ready' : 'Review'),
      detail: locale === 'ko' ? '농약 추천' : '/api/pesticides/recommend',
      trendLabel: locale === 'ko' ? '상담' : 'advisor',
      icon: ShieldCheck,
      tone: protectionReady ? 'normal' : 'warning',
      series: summary ? [summary.pesticideReady ? 1 : 0, protectionReady ? 1 : 0] : [],
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '농약 솔루션 흐름' : 'Protection signal',
    },
    {
      label: 'VPD',
      value: formatNumber(currentData.vpd, 2),
      unit: 'kPa',
      detail: `${formatNumber(currentData.humidity, 0)}% RH`,
      trendLabel: 'climate',
      icon: Bell,
      tone: currentData.vpd > 1.4 || currentData.vpd < 0.5 ? 'warning' : 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'vpd', 24), currentData.vpd, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '습도 부담 흐름' : 'VPD trend',
    },
    {
      label: locale === 'ko' ? '수확' : 'Yield',
      value: formatNumber(metrics.yield.predictedWeekly, 1),
      unit: 'kg/wk',
      detail: locale === 'ko' ? '수확 영향 확인' : 'check harvest impact',
      trendLabel: locale === 'ko' ? '작물' : 'crop',
      icon: ShieldCheck,
      tone: 'normal',
      series: mapNumericSeries(forecast?.daily, (day) => day.harvest_kg, 14),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '수확 예측 흐름' : 'Harvest forecast trend',
    },
  ];
  const actions: FeatureActionCard[] = [
    {
      title: locale === 'ko' ? '농약 타깃 선택' : 'Pesticide target',
      body: locale === 'ko' ? '흰가루병, 온실가루이, 담배가루이, 노균병, 나방류별 추천 cycle을 확인합니다.' : 'Review cycles for mildew, whiteflies, downy mildew, and moths.',
      chip: locale === 'ko' ? '농약 추천' : '/api/pesticides/recommend',
      icon: ShieldCheck,
      tone: protectionReady ? 'normal' : 'warning',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('alerts-protection'),
    },
    {
      title: locale === 'ko' ? '긴급 위험' : 'Critical risk',
      body: locale === 'ko' ? '긴급 위험은 빨간색 계열로만 표시하고 조치 우선순위를 분리합니다.' : 'Critical risks stay visually separated with red status only.',
      chip: locale === 'ko' ? '긴급' : 'critical',
      icon: AlertTriangle,
      tone: criticalCount ? 'critical' : 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('alerts-warning'),
    },
    {
      title: locale === 'ko' ? '확인 필요' : 'Watch queue',
      body: locale === 'ko' ? '센서 지연, 환경 위험, 상담 알림을 하나의 확인 목록으로 봅니다.' : 'Sensor delay, climate risk, and advisor warnings stay in one watch queue.',
      chip: locale === 'ko' ? '확인 목록' : 'watch',
      icon: Bell,
      tone: warningCount ? 'warning' : 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('alerts-warning'),
    },
    {
      title: locale === 'ko' ? '처리 이력' : 'Handling history',
      body: locale === 'ko' ? '저장된 알림 처리 이력을 시간순으로 확인합니다.' : 'Review alert handling history as a timeline.',
      chip: locale === 'ko' ? '처리 이력' : '/api/alerts/history',
      icon: History,
      tone: alertHistory.error ? 'warning' : 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('alerts-history'),
    },
  ];
  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: locale === 'ko' ? '농약 솔루션' : 'Pesticide',
      value: locale === 'ko' ? (protectionReady ? '준비됨' : '검토') : (protectionReady ? 'Ready' : 'Review'),
      body: locale === 'ko' ? '집중 타깃별 cycle과 제품 rotation을 확인합니다.' : 'Review target-specific cycles and product rotation.',
      chip: locale === 'ko' ? '솔루션' : 'solution',
      chipTone: protectionReady ? 'growth' : 'warning',
      icon: ShieldCheck,
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('alerts-protection'),
    },
    {
      title: locale === 'ko' ? '주의 큐' : 'Watch',
      value: `${criticalCount + warningCount}`,
      body: locale === 'ko' ? '긴급과 주의 항목을 분리해 처리합니다.' : 'Separate critical and warning items.',
      chip: locale === 'ko' ? '확인 목록' : 'watch',
      chipTone: criticalCount ? 'critical' : warningCount ? 'warning' : 'stable',
      icon: Bell,
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('alerts-warning'),
    },
    {
      title: locale === 'ko' ? '이력' : 'History',
      value: `${alertHistory.events.length}`,
      body: locale === 'ko' ? '저장된 처리 이력을 유지합니다.' : 'Keep handling history visible.',
      chip: locale === 'ko' ? '이력' : 'history',
      chipTone: alertHistory.error ? 'warning' : 'growth',
      icon: History,
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('alerts-history'),
    },
  ];

  return (
    <FeatureLandingFrame
      title={copy.title}
      description={copy.description}
      heroBadge={copy.heroBadge}
      heroTitle={copy.heroTitle}
      heroBody={copy.heroBody}
      primaryAction={{ label: copy.primary, onClick: () => onSelectTab?.('alerts-protection') }}
      secondaryAction={{ label: copy.secondary, onClick: () => onSelectTab?.('alerts-history'), variant: 'secondary' }}
      preview={{
        eyebrow: 'PROTECTION LIVE',
        title: locale === 'ko' ? '농약 · 확인 목록 · 이력' : 'Pesticide / Watch / History',
        statusLabel: criticalCount ? 'critical' : warningCount ? 'watch' : 'stable',
        statusTone: criticalCount ? 'critical' : warningCount ? 'warning' : 'growth',
        metrics: [
          { label: locale === 'ko' ? '긴급' : 'Critical', value: `${criticalCount}`, detail: locale === 'ko' ? '빨간색만' : 'red only' },
          { label: locale === 'ko' ? '주의' : 'Watch', value: `${warningCount}`, detail: telemetryStatus },
          { label: locale === 'ko' ? '이력' : 'History', value: `${alertHistory.events.length}`, detail: locale === 'ko' ? '처리 이력' : '/api/alerts/history' },
        ],
        chartLabel: locale === 'ko' ? '위험·처리 이력 흐름' : 'Risk and history flow',
        chartStatus: alertHistory.error ?? statusSummary,
        chartValues: alertTrendValues,
      }}
      metricsEyebrow={copy.live}
      metricsFreshness={copy.freshness}
      metrics={featureMetrics}
      actionsEyebrow={copy.actionsEyebrow}
      actionsTitle={copy.actionsTitle}
      actions={actions}
      comparisonEyebrow={copy.comparisonEyebrow}
      comparisonTitle={copy.comparisonTitle}
      comparisonStatusLabel={copy.comparisonStatus}
      comparisonStatusTone={criticalCount ? 'critical' : warningCount ? 'warning' : 'growth'}
      comparisonNote={crop}
      baseline={{
        title: locale === 'ko' ? '현재 위험' : 'Current risk',
        subtitle: locale === 'ko' ? '센서·환경·상담 알림' : 'Sensor, climate, and advisor alerts',
        badgeCaption: locale === 'ko' ? '위험' : 'RISK',
        badgeLabel: `${criticalCount + warningCount}`,
        rows: [
          [locale === 'ko' ? '긴급' : 'Critical', `${criticalCount}`],
          [locale === 'ko' ? '주의' : 'Warning', `${warningCount}`],
          [locale === 'ko' ? '습도 부담' : 'VPD', `${formatNumber(currentData.vpd, 2)} kPa`],
          [locale === 'ko' ? '수확 전망' : 'Yield', `${formatNumber(metrics.yield.predictedWeekly, 1)} kg`],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '처리 방향' : 'Handling plan',
        subtitle: locale === 'ko' ? '농약 솔루션과 처리 이력' : 'Pesticide solution and history',
        badgeCaption: locale === 'ko' ? '방향' : 'PLAN',
        badgeLabel: locale === 'ko' ? (protectionReady ? '준비됨' : '검토') : (protectionReady ? 'Ready' : 'Review'),
        rows: [
          [locale === 'ko' ? '농약' : 'Pesticide', locale === 'ko' ? (protectionReady ? '준비' : '검토') : (protectionReady ? 'ready' : 'review')],
          [locale === 'ko' ? '이력' : 'History', `${alertHistory.events.length}`],
          [locale === 'ko' ? '처리됨' : 'Resolved', `${resolvedCount}`],
          [locale === 'ko' ? '수확' : 'Yield', `${formatNumber(metrics.yield.predictedWeekly, 1)} kg`],
        ],
      }}
      bridgeEyebrow={copy.bridgeEyebrow}
      bridgeTitle={copy.bridgeTitle}
      bridgeCards={bridgeCards}
      detailEyebrow={copy.detailEyebrow}
      detailTitle={copy.detailTitle}
      detailDescription={copy.detailDescription}
      sectionTabs={tabs}
      activeSectionId={activeSurfaceId}
      onSelectSection={onSelectTab}
      onOpenAssistant={onOpenAssistant}
    >
      <section id="alerts-surfaces" className="scroll-mt-24 space-y-4" aria-label={copy.detailTitle}>
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '긴급 알림 센터' : 'Alerts center'}
              loadingMessage={locale === 'ko' ? '긴급 알림 화면을 불러오는 중입니다...' : 'Loading alerts center...'}
              minHeightClassName="min-h-[520px]"
            />
          )}
        >
          <AlertsCommandCenter
            locale={locale}
            items={fallbackItems}
            crop={crop}
            summary={summary}
            currentData={currentData}
            metrics={metrics}
            history={history}
            forecast={forecast}
            producePrices={producePrices}
            weather={weather}
            rtrProfile={rtrProfile}
            telemetryStatus={telemetryStatus}
            statusSummary={statusSummary}
            primaryTiles={primaryTiles}
            secondaryTiles={secondaryTiles}
            activePanel={activePanel}
            historyItems={alertHistory.events}
            historyLoading={alertHistory.loading}
            historyError={alertHistory.error}
          />
        </Suspense>
      </section>
    </FeatureLandingFrame>
  );
}
