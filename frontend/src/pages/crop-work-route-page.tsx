import { Suspense, lazy } from 'react';
import CropDetails from '../components/CropDetails';
import TodayBoard from '../components/dashboard/TodayBoard';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { AppLocale } from '../i18n/locale';
import type { AdvancedModelMetrics, CropType, ForecastData, SensorData } from '../types';
import CropWorkPage from './crop-work-page';

const ForecastPanel = lazy(() => import('../components/ForecastPanel'));
const ConsultingReport = lazy(() => import('../components/ConsultingReport'));

interface CropWorkRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  forecast: ForecastData | null;
  aiAnalysis: string | null;
  actionsNow: string[];
  actionsToday: string[];
  actionsWeek: string[];
  monitor: string[];
  tabs: Array<{ id: string; label: string }>;
  activeTabId?: string;
  onSelectTab: (tabId: string) => void;
}

export default function CropWorkRoutePage({
  locale,
  crop,
  currentData,
  modelMetrics,
  forecast,
  aiAnalysis,
  actionsNow,
  actionsToday,
  actionsWeek,
  monitor,
  tabs,
  activeTabId,
  onSelectTab,
}: CropWorkRoutePageProps) {
  return (
    <CropWorkPage
      locale={locale}
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
      cropSummary={<CropDetails crop={crop} currentData={currentData} metrics={modelMetrics} />}
      workBoard={(
        <TodayBoard
          actionsNow={actionsNow}
          actionsToday={actionsToday}
          actionsWeek={actionsWeek}
          monitor={monitor}
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
      )}
    />
  );
}
