import type { ReactNode } from 'react';
import AdvisorTabs from '../components/advisor/AdvisorTabs';
import PageHeader from '../components/common/PageHeader';
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
import type { PromptAdvisorTabKey } from '../components/advisor/advisorTabRegistry';

interface AdvisorLaneRoutePageProps {
  locale: AppLocale;
  eyebrow: string;
  title: string;
  description: string;
  crop: CropType;
  summary?: SmartGrowKnowledgeSummary | null;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
  history?: SensorData[];
  forecast?: ForecastData | null;
  producePrices?: ProducePricesPayload | null;
  weather?: WeatherOutlook | null;
  rtrProfile?: RtrProfile | null;
  initialTab: PromptAdvisorTabKey;
  initialCorrectionToolOpen?: boolean;
  onClose: () => void;
  secondarySurface?: ReactNode;
}

export default function AdvisorLaneRoutePage({
  locale,
  eyebrow,
  title,
  description,
  crop,
  summary,
  currentData,
  metrics,
  history,
  forecast,
  producePrices,
  weather,
  rtrProfile,
  initialTab,
  initialCorrectionToolOpen = false,
  onClose,
  secondarySurface = null,
}: AdvisorLaneRoutePageProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className={`grid gap-6 ${secondarySurface ? '2xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]' : ''}`}>
        <div className="min-w-0">
          <AdvisorTabs
            crop={crop}
            summary={summary}
            currentData={currentData}
            metrics={metrics}
            history={history}
            forecast={forecast}
            producePrices={producePrices}
            weather={weather}
            rtrProfile={rtrProfile}
            isOpen
            initialTab={initialTab}
            initialCorrectionToolOpen={initialCorrectionToolOpen}
            onClose={onClose}
          />
        </div>
        {secondarySurface ? (
          <div className="min-w-0 space-y-6">{secondarySurface}</div>
        ) : null}
      </div>
      <p className="max-w-[680px] text-sm leading-7 text-[color:var(--sg-text-muted)]">
        {locale === 'ko'
          ? '이 페이지는 한 번에 한 lane만 보여주도록 유지합니다.'
          : 'This page keeps one advisor lane in focus instead of stacking multiple stories.'}
      </p>
    </div>
  );
}
