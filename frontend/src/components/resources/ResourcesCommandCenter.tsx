import { Suspense, lazy } from 'react';
import type {
    AdvancedModelMetrics,
    CropType,
    ForecastData,
    ProducePricesPayload,
    RtrProfile,
    SensorData,
    WeatherOutlook,
} from '../../types';
import type { SmartGrowKnowledgeSummary } from '../../hooks/useSmartGrowKnowledge';
import DecisionSnapshotGrid from '../dashboard/DecisionSnapshotGrid';
import WeatherOutlookPanel from '../WeatherOutlookPanel';
import AdvisorTabs from '../advisor/AdvisorTabs';
import LoadingSkeleton from '../../features/common/LoadingSkeleton';

const ProducePricesPanel = lazy(() => import('../ProducePricesPanel'));

interface ResourcesCommandCenterProps {
    locale: 'ko' | 'en';
    crop: CropType;
    cropLabel: string;
    currentData: SensorData;
    modelMetrics: AdvancedModelMetrics;
    history?: SensorData[];
    forecast?: ForecastData | null;
    summary?: SmartGrowKnowledgeSummary | null;
    weather: WeatherOutlook | null;
    weatherLoading: boolean;
    weatherError: string | null;
    producePrices: ProducePricesPayload | null;
    rtrProfile?: RtrProfile | null;
    produceLoading: boolean;
    produceError: string | null;
    activePanel?: 'resources-nutrient' | 'resources-energy' | 'resources-market';
    initialCorrectionToolOpen?: boolean;
}

export default function ResourcesCommandCenter({
    locale,
    crop,
    currentData,
    modelMetrics,
    history = [],
    forecast = null,
    summary = null,
    weather,
    weatherLoading,
    weatherError,
    producePrices,
    rtrProfile = null,
    produceLoading,
    produceError,
    activePanel = 'resources-energy',
    initialCorrectionToolOpen = false,
}: ResourcesCommandCenterProps) {
    return (
        <div className="space-y-6">
            {activePanel === 'resources-energy' ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                    <WeatherOutlookPanel
                        weather={weather}
                        loading={weatherLoading}
                        error={weatherError}
                    />
                    <DecisionSnapshotGrid
                        crop={crop}
                        currentData={currentData}
                        modelMetrics={modelMetrics}
                        weather={weather}
                        weatherLoading={weatherLoading}
                        producePrices={producePrices}
                        produceLoading={produceLoading}
                    />
                </div>
            ) : null}

            {activePanel === 'resources-market' ? (
                <Suspense
                    fallback={(
                        <LoadingSkeleton
                            title={locale === 'ko' ? '도매 시세' : 'Wholesale prices'}
                            loadingMessage={locale === 'ko' ? '시세 차트를 불러오는 중입니다...' : 'Loading price chart...'}
                            minHeightClassName="min-h-[520px]"
                        />
                    )}
                >
                    <ProducePricesPanel
                        prices={producePrices}
                        loading={produceLoading}
                        error={produceError}
                    />
                </Suspense>
            ) : null}

            {activePanel === 'resources-nutrient' ? (
                <AdvisorTabs
                    key={`${crop}-nutrient`}
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
                    initialTab="nutrient"
                    initialCorrectionToolOpen={initialCorrectionToolOpen}
                    onClose={() => undefined}
                    showCloseAction={false}
                />
            ) : null}
        </div>
    );
}
