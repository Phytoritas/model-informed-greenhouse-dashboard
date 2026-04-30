import { Suspense, lazy } from 'react';
import { CalendarDays, ClipboardList, Leaf, Sprout, TrendingUp } from 'lucide-react';
import CropDetails from '../components/CropDetails';
import TodayBoard from '../components/dashboard/TodayBoard';
import FeatureLandingFrame, {
  type FeatureActionCard,
  type FeatureBridgeCard,
  type FeatureMetric,
} from '../components/dashboard/FeatureLandingFrame';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import AdvisorTabs from '../components/advisor/AdvisorTabs';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  MetricHistoryPoint,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  WeatherOutlook,
} from '../types';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import { appendFiniteValue, mapNumericSeries, pickNumericSeries } from '../utils/metricTrendSeries';

const ForecastPanel = lazy(() => import('../components/ForecastPanel'));
const ConsultingReport = lazy(() => import('../components/ConsultingReport'));

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

interface CropWorkRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  history?: SensorData[];
  metricHistory?: MetricHistoryPoint[];
  forecast: ForecastData | null;
  summary?: SmartGrowKnowledgeSummary | null;
  producePrices?: ProducePricesPayload | null;
  weather?: WeatherOutlook | null;
  rtrProfile?: RtrProfile | null;
  aiAnalysis: string | null;
  actionsNow: string[];
  actionsToday: string[];
  actionsWeek: string[];
  monitor: string[];
  activePanel?: 'crop-work-growth' | 'crop-work-work' | 'crop-work-harvest';
  onOpenAssistant: () => void;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function CropWorkRoutePage({
  locale,
  crop,
  currentData,
  modelMetrics,
  history = [],
  metricHistory = [],
  forecast,
  summary = null,
  producePrices = null,
  weather = null,
  rtrProfile = null,
  aiAnalysis,
  actionsNow,
  actionsToday,
  actionsWeek,
  monitor,
  activePanel = 'crop-work-growth',
  onOpenAssistant,
  tabs = [],
  activeTabId,
  onSelectTab,
}: CropWorkRoutePageProps) {
  const advisorInitialTab = activePanel === 'crop-work-work'
    ? 'work'
    : activePanel === 'crop-work-harvest'
      ? 'harvest_market'
      : 'physiology';
  const selectedTabId = activeTabId ?? activePanel;
  const showGrowth = selectedTabId === 'crop-work-growth';
  const showWork = selectedTabId === 'crop-work-work';
  const showHarvest = selectedTabId === 'crop-work-harvest';
  const cropLabel = locale === 'ko'
    ? (crop === 'Cucumber' ? '오이' : '토마토')
    : crop.toLowerCase();
  const growthSeries = history.length
    ? history.slice(-8).map((point) => point.photosynthesis || modelMetrics.growth.growthRate)
    : [modelMetrics.growth.lai, modelMetrics.growth.growthRate, modelMetrics.yield.predictedWeekly, currentData.photosynthesis];
  const sourceSinkBalance = currentData.photosynthesis - (modelMetrics.yield.harvestableFruits / 10);
  const copy = locale === 'ko'
    ? {
        title: '작물·농작업',
        description: '마디 전개, 생육 균형, 농작업, 수확 흐름을 초보자도 따라갈 수 있게 분리했습니다.',
        heroBadge: '작물·농작업 의사결정',
        heroTitle: '오이 생육과 오늘 작업을 한 화면에서 판단합니다',
        heroBody: '마디 전개, 착과 부담, 동화·분배 균형, 오늘 할 일을 그래프와 카드로 같이 보여줍니다.',
        primary: '생육 그래프',
        secondary: '작업 우선순위',
        live: '작물·작업 요약',
        freshness: '상담·수확예측 연결됨',
        actionsEyebrow: '작물 판단 전 확인',
        actionsTitle: '작물 상태를 보기 전에 확인할 4가지',
        comparisonEyebrow: '생육 균형',
        comparisonTitle: '현재 생육 신호와 수확 부담 비교',
        comparisonStatus: '연결됨',
        bridgeEyebrow: '생육 · 작업 · 수확',
        bridgeTitle: '생육 판단 요약',
        detailEyebrow: '세부 기능',
        detailTitle: '생육·농작업·수확 상세 화면',
        detailDescription: '생육, 작업, 수확을 세부 탭으로 나눠 단계별로 확인합니다.',
        open: '열기',
      }
    : {
        title: 'Crop Work',
        description: 'Separate node pace, growth balance, work priorities, and harvest flow for beginner-friendly use.',
        heroBadge: 'Crop and work decision lane',
        heroTitle: 'Read cucumber growth and today work in one page',
        heroBody: 'Node pace, fruit load, source-sink balance, and today’s work queue appear as charts and cards together.',
        primary: 'Growth chart',
        secondary: 'Work priorities',
        live: 'Crop Work Live Overview',
        freshness: 'advisor · model · forecast connected',
        actionsEyebrow: 'Crop Action Board',
        actionsTitle: 'Four checks before crop decisions',
        comparisonEyebrow: 'Growth Balance',
        comparisonTitle: 'Current growth signal vs harvest load',
        comparisonStatus: 'connected',
        bridgeEyebrow: 'Growth · Work · Harvest',
        bridgeTitle: 'Crop summary',
        detailEyebrow: 'CROP WORK FULL SURFACES',
        detailTitle: 'Growth, work, and harvest workspace',
        detailDescription: 'Detailed growth, work, and harvest functions stay available below in the PNG-style frame.',
        open: 'Open',
      };

  const advisorSurface = (
    <AdvisorTabs
      key={`${crop}-${advisorInitialTab}`}
      crop={crop}
      summary={summary}
      currentData={currentData}
      metrics={modelMetrics}
      history={history}
      forecast={forecast}
      producePrices={producePrices}
      weather={weather}
      rtrProfile={rtrProfile}
      isOpen
      initialTab={advisorInitialTab}
      onClose={onOpenAssistant}
      showCloseAction={false}
    />
  );
  const cropSummary = <CropDetails crop={crop} currentData={currentData} metrics={modelMetrics} />;
  const workBoard = (
    <TodayBoard
      actionsNow={actionsNow}
      actionsToday={actionsToday}
      actionsWeek={actionsWeek}
      monitor={monitor}
      compact
    />
  );
  const forecastSurface = (
    <Suspense
      fallback={(
        <LoadingSkeleton
          title={locale === 'ko' ? '생육 전망' : 'Growth outlook'}
          loadingMessage={locale === 'ko' ? '생육 전망을 불러오는 중입니다...' : 'Loading growth outlook...'}
          minHeightClassName="min-h-[320px]"
        />
      )}
    >
      <ForecastPanel forecast={forecast} crop={crop} />
    </Suspense>
  );
  const recentWorkSurface = (
    <div className="space-y-5">
      <Suspense
        fallback={(
          <LoadingSkeleton
            title={locale === 'ko' ? '운영 리포트' : 'Operating report'}
            loadingMessage={locale === 'ko' ? '운영 리포트를 불러오는 중입니다...' : 'Loading operating report...'}
            minHeightClassName="min-h-[320px]"
          />
        )}
      >
        <ConsultingReport
          analysis={aiAnalysis ?? ''}
          metrics={modelMetrics}
          currentData={currentData}
          crop={crop}
        />
      </Suspense>
    </div>
  );

  const metrics: FeatureMetric[] = [
    {
      label: 'LAI',
      value: formatNumber(modelMetrics.growth.lai, 2),
      detail: modelMetrics.growth.developmentStage,
      trendLabel: 'canopy',
      icon: Leaf,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(metricHistory, 'lai', 24), modelMetrics.growth.lai, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '잎면적 흐름' : 'LAI trend',
    },
    {
      label: locale === 'ko' ? '마디' : 'Node',
      value: formatNumber(modelMetrics.growth.nodeCount, 0),
      detail: locale === 'ko' ? '마디 전개' : 'node pace',
      trendLabel: locale === 'ko' ? '생육' : 'growth',
      icon: Sprout,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(metricHistory, 'nodeCount', 24), modelMetrics.growth.nodeCount, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '마디 전개 흐름' : 'Node trend',
    },
    {
      label: locale === 'ko' ? '생장' : 'Growth',
      value: formatNumber(modelMetrics.growth.growthRate, 2),
      detail: locale === 'ko' ? '생장률' : 'growth rate',
      trendLabel: locale === 'ko' ? '모델' : 'model',
      icon: TrendingUp,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(metricHistory, 'growthRate', 24), modelMetrics.growth.growthRate, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '생장률 흐름' : 'Growth-rate trend',
    },
    {
      label: locale === 'ko' ? '광합성' : 'Source',
      value: formatNumber(currentData.photosynthesis, 1),
      unit: 'µmol',
      detail: locale === 'ko' ? '광합성' : 'photosynthesis',
      trendLabel: locale === 'ko' ? '공급력' : 'source',
      icon: Leaf,
      tone: 'normal',
      series: appendFiniteValue(pickNumericSeries(history, 'photosynthesis', 24), currentData.photosynthesis, 24),
      chartKind: 'line',
      chartLabel: locale === 'ko' ? '광합성 흐름' : 'Photosynthesis trend',
    },
    {
      label: locale === 'ko' ? '착과부담' : 'Sink',
      value: formatNumber(modelMetrics.yield.harvestableFruits, 0),
      detail: locale === 'ko' ? '수확 가능 과실' : 'harvestable fruits',
      trendLabel: locale === 'ko' ? '부담' : 'load',
      icon: CalendarDays,
      tone: sourceSinkBalance < 0 ? 'warning' : 'normal',
      series: appendFiniteValue(pickNumericSeries(metricHistory, 'harvestableFruits', 24), modelMetrics.yield.harvestableFruits, 24),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '착과 부담 흐름' : 'Sink-load trend',
    },
    {
      label: locale === 'ko' ? '수확' : 'Yield',
      value: formatNumber(modelMetrics.yield.predictedWeekly, 1),
      unit: 'kg/wk',
      detail: locale === 'ko' ? `신뢰도 ${formatNumber(modelMetrics.yield.confidence * 100, 0)}%` : `${formatNumber(modelMetrics.yield.confidence * 100, 0)}% confidence`,
      trendLabel: locale === 'ko' ? '예측' : 'forecast',
      icon: TrendingUp,
      tone: 'normal',
      series: mapNumericSeries(forecast?.daily, (day) => day.harvest_kg, 14),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '수확 예측 흐름' : 'Harvest forecast trend',
    },
    {
      label: locale === 'ko' ? '작업' : 'Work',
      value: `${actionsToday.length}`,
      detail: locale === 'ko' ? '오늘 작업 카드' : 'today action cards',
      trendLabel: locale === 'ko' ? '상담' : 'advisor',
      icon: ClipboardList,
      tone: actionsToday.length ? 'warning' : 'muted',
      series: [actionsNow.length, actionsToday.length, actionsWeek.length].filter((value) => Number.isFinite(value)),
      chartKind: 'bar',
      chartLabel: locale === 'ko' ? '작업 부담 흐름' : 'Workload trend',
    },
  ];

  const actions: FeatureActionCard[] = [
    {
      title: locale === 'ko' ? '마디 전개' : 'Node pace',
      body: locale === 'ko' ? '마디 수, LAI, 생장률을 함께 보고 생육 균형을 판단합니다.' : 'Read node count, LAI, and growth rate together.',
      chip: locale === 'ko' ? '생육 상담' : '/api/advisor/tab/physiology',
      icon: Sprout,
      tone: 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('crop-work-growth'),
    },
    {
      title: locale === 'ko' ? '공급력·착과부담 균형' : 'Source-sink balance',
      body: locale === 'ko' ? '광합성과 수확 부담 차이를 그래프와 카드로 확인합니다.' : 'Compare assimilation and harvest load as a decision signal.',
      chip: locale === 'ko' ? '수확 계산' : 'model runtime',
      icon: Leaf,
      tone: sourceSinkBalance < 0 ? 'warning' : 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('crop-work-growth'),
    },
    {
      title: locale === 'ko' ? '오늘 작업' : 'Today work',
      body: locale === 'ko' ? '현재 할 일과 주간 작업을 분리해서 봅니다.' : 'Separate urgent work from weekly work.',
      chip: locale === 'ko' ? '작업 추천' : '/api/work/recommend',
      icon: ClipboardList,
      tone: actionsNow.length ? 'warning' : 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('crop-work-work'),
    },
    {
      title: locale === 'ko' ? '수확 흐름' : 'Harvest flow',
      body: locale === 'ko' ? '예측 수확량과 시세 흐름을 수확 판단에 연결합니다.' : 'Connect forecast harvest with market context.',
      chip: locale === 'ko' ? '수확 상담' : '/api/advisor/harvest',
      icon: CalendarDays,
      tone: 'normal',
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('crop-work-harvest'),
    },
  ];

  const bridgeCards: FeatureBridgeCard[] = [
    {
      title: locale === 'ko' ? '생육' : 'Growth',
      value: `LAI ${formatNumber(modelMetrics.growth.lai, 2)}`,
      body: locale === 'ko' ? '마디 전개와 동화·분배 균형을 봅니다.' : 'Open node pace and source-sink balance.',
      chip: locale === 'ko' ? '생육' : 'physiology',
      chipTone: 'growth',
      icon: Sprout,
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('crop-work-growth'),
    },
    {
      title: locale === 'ko' ? '작업' : 'Work',
      value: `${actionsToday.length}`,
      body: locale === 'ko' ? '오늘 작업, 이번 주 작업, 모니터링 항목을 분리합니다.' : 'Separate today, week, and monitor items.',
      chip: locale === 'ko' ? '작업' : 'work',
      chipTone: actionsToday.length ? 'warning' : 'stable',
      icon: ClipboardList,
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('crop-work-work'),
    },
    {
      title: locale === 'ko' ? '수확' : 'Harvest',
      value: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg`,
      body: locale === 'ko' ? '수확 예측과 시세 맥락을 연결합니다.' : 'Connect forecast harvest with market context.',
      chip: locale === 'ko' ? '수확' : 'harvest',
      chipTone: 'growth',
      icon: CalendarDays,
      actionLabel: copy.open,
      onAction: () => onSelectTab?.('crop-work-harvest'),
    },
  ];

  return (
    <FeatureLandingFrame
      title={copy.title}
      description={copy.description}
      heroBadge={copy.heroBadge}
      heroTitle={copy.heroTitle}
      heroBody={copy.heroBody}
      primaryAction={{ label: copy.primary, onClick: () => onSelectTab?.('crop-work-growth') }}
      secondaryAction={{ label: copy.secondary, onClick: () => onSelectTab?.('crop-work-work'), variant: 'secondary' }}
      preview={{
        eyebrow: 'CROP LIVE',
        title: locale === 'ko' ? '생육 · 작업 · 수확' : 'Growth / Work / Harvest',
        statusLabel: locale === 'ko' ? (summary ? '연결됨' : '모델') : (summary ? 'connected' : 'model'),
        statusTone: sourceSinkBalance < 0 ? 'warning' : 'growth',
        metrics: [
          { label: 'LAI', value: formatNumber(modelMetrics.growth.lai, 2), detail: modelMetrics.growth.developmentStage },
          { label: locale === 'ko' ? '마디' : 'Node', value: formatNumber(modelMetrics.growth.nodeCount, 0), detail: cropLabel },
          { label: locale === 'ko' ? '수확' : 'Yield', value: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg`, detail: locale === 'ko' ? '주간' : 'weekly' },
        ],
        chartLabel: locale === 'ko' ? '최근 광합성·생육 흐름' : 'Recent assimilation and growth',
        chartStatus: locale === 'ko' ? (sourceSinkBalance < 0 ? '착과 부담' : '균형') : (sourceSinkBalance < 0 ? 'sink pressure' : 'balanced'),
        chartValues: growthSeries,
      }}
      metricsEyebrow={copy.live}
      metricsFreshness={copy.freshness}
      metrics={metrics}
      actionsEyebrow={copy.actionsEyebrow}
      actionsTitle={copy.actionsTitle}
      actions={actions}
      comparisonEyebrow={copy.comparisonEyebrow}
      comparisonTitle={copy.comparisonTitle}
      comparisonStatusLabel={copy.comparisonStatus}
      comparisonStatusTone={sourceSinkBalance < 0 ? 'warning' : 'growth'}
      comparisonNote={cropLabel}
      baseline={{
        title: locale === 'ko' ? '현재 생육 신호' : 'Current growth signal',
        subtitle: locale === 'ko' ? '광합성·증산·LAI' : 'Assimilation, transpiration, LAI',
        badgeCaption: locale === 'ko' ? '공급' : 'SOURCE',
        badgeLabel: formatNumber(currentData.photosynthesis, 1),
        rows: [
          [locale === 'ko' ? '광합성' : 'Photo', `${formatNumber(currentData.photosynthesis, 1)} µmol`],
          [locale === 'ko' ? '증산' : 'Transp', `${formatNumber(currentData.transpiration, 2)}`],
          ['LAI', formatNumber(modelMetrics.growth.lai, 2)],
          [locale === 'ko' ? '생체량' : 'Biomass', formatNumber(modelMetrics.growth.biomass, 1)],
        ],
      }}
      optimized={{
        title: locale === 'ko' ? '수확 부담과 작업' : 'Harvest load and work',
        subtitle: locale === 'ko' ? '착과 부담·수량·작업 카드' : 'Fruit load, yield, action cards',
        badgeCaption: locale === 'ko' ? '부담' : 'SINK',
        badgeLabel: `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg`,
        rows: [
          [locale === 'ko' ? '수확과' : 'Fruits', formatNumber(modelMetrics.yield.harvestableFruits, 0)],
          [locale === 'ko' ? '마디' : 'Node', formatNumber(modelMetrics.growth.nodeCount, 0)],
          [locale === 'ko' ? '오늘' : 'Today', `${actionsToday.length}`],
          [locale === 'ko' ? '주간' : 'Week', `${actionsWeek.length}`],
        ],
      }}
      bridgeEyebrow={copy.bridgeEyebrow}
      bridgeTitle={copy.bridgeTitle}
      bridgeCards={bridgeCards}
      detailEyebrow={copy.detailEyebrow}
      detailTitle={copy.detailTitle}
      detailDescription={copy.detailDescription}
      sectionTabs={tabs}
      activeSectionId={selectedTabId}
      onSelectSection={onSelectTab}
      onOpenAssistant={onOpenAssistant}
    >
      <section id="crop-work-surfaces" className="scroll-mt-24 space-y-4" aria-label={copy.detailTitle}>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {showGrowth ? (
            <>
              <div className="min-h-0 xl:col-span-5 [&>*]:h-full">{cropSummary}</div>
              <div className="min-h-0 xl:col-span-7 [&>*]:h-full">{advisorSurface}</div>
            </>
          ) : null}
          {showWork ? (
            <>
              <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{workBoard}</div>
              <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{recentWorkSurface}</div>
            </>
          ) : null}
          {showHarvest ? (
            <>
              <div className="min-h-0 xl:col-span-8 [&>*]:h-full">{advisorSurface}</div>
              <div className="min-h-0 xl:col-span-4 [&>*]:h-full">{forecastSurface}</div>
            </>
          ) : null}
        </div>
      </section>
    </FeatureLandingFrame>
  );
}
