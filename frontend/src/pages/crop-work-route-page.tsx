import { Suspense, lazy } from 'react';
import CropDetails from '../components/CropDetails';
import TodayBoard from '../components/dashboard/TodayBoard';
import ModelRuntimeBridge from '../components/dashboard/ModelRuntimeBridge';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import AdvisorTabs from '../components/advisor/AdvisorTabs';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  WeatherOutlook,
} from '../types';
import CropWorkPage from './crop-work-page';

const ForecastPanel = lazy(() => import('../components/ForecastPanel'));
const ConsultingReport = lazy(() => import('../components/ConsultingReport'));

interface CropWorkRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  history?: SensorData[];
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
}

export default function CropWorkRoutePage({
  locale,
  crop,
  currentData,
  modelMetrics,
  history = [],
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
}: CropWorkRoutePageProps) {
  const advisorInitialTab = activePanel === 'crop-work-work'
    ? 'work'
    : activePanel === 'crop-work-harvest'
      ? 'harvest_market'
      : 'physiology';
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

  return (
    <CropWorkPage
      locale={locale}
      activeTabId={activePanel}
      cropSummary={<CropDetails crop={crop} currentData={currentData} metrics={modelMetrics} />}
      advisorSurface={advisorSurface}
      workBoard={(
        <TodayBoard
          actionsNow={actionsNow}
          actionsToday={actionsToday}
          actionsWeek={actionsWeek}
          monitor={monitor}
          compact
        />
      )}
      forecastSurface={(
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
      )}
      recentWorkSurface={(
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
          <ModelRuntimeBridge
            crop={crop}
            onOpenAssistant={onOpenAssistant}
          />
        </div>
      )}
    />
  );
}
