import DecisionSnapshotGrid from '../components/dashboard/DecisionSnapshotGrid';
import ProducePricesPanel from '../components/ProducePricesPanel';
import WeatherTrendPanel from '../components/dashboard/WeatherTrendPanel';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  OverviewSignalsPayload,
  ProducePricesPayload,
  SensorData,
  WeatherOutlook,
} from '../types';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { PhytoSectionTab } from '../routes/phytosyncSections';
import TrendPage from './trend-page';

interface TrendRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  history: SensorData[];
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
  produceError: string | null;
  overviewSignals: OverviewSignalsPayload | null;
  knowledgeSummary: SmartGrowKnowledgeSummary | null;
  knowledgeLoading: boolean;
  knowledgeError: string | null;
  onOpenAssistant: () => void;
  tabs?: PhytoSectionTab[];
  activeTabId?: string;
  onSelectTab?: (id: string) => void;
}

export default function TrendRoutePage({
  locale,
  crop,
  currentData,
  modelMetrics,
  history,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  produceLoading,
  produceError,
  overviewSignals,
  knowledgeSummary,
  knowledgeLoading,
  knowledgeError,
  onOpenAssistant,
  tabs = [],
  activeTabId,
  onSelectTab,
}: TrendRoutePageProps) {
  return (
    <TrendPage
      locale={locale}
      crop={crop}
      currentData={currentData}
      modelMetrics={modelMetrics}
      history={history}
      weather={weather}
      weatherLoading={weatherLoading}
      weatherError={weatherError}
      producePrices={producePrices}
      produceLoading={produceLoading}
      produceError={produceError}
      overviewSignals={overviewSignals}
      knowledgeSummary={knowledgeSummary}
      knowledgeLoading={knowledgeLoading}
      knowledgeError={knowledgeError}
      onOpenAssistant={onOpenAssistant}
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
      weatherSurface={(
        <WeatherTrendPanel
          weather={weather}
          loading={weatherLoading}
          error={weatherError}
        />
      )}
      marketSurface={(
        <ProducePricesPanel
          prices={producePrices}
          loading={produceLoading}
          error={produceError}
        />
      )}
      decisionSurface={(
        <DecisionSnapshotGrid
          crop={crop}
          currentData={currentData}
          modelMetrics={modelMetrics}
          weather={weather}
          weatherLoading={weatherLoading}
          producePrices={producePrices}
          produceLoading={produceLoading}
          history={history}
          overviewSignals={overviewSignals}
        />
      )}
    />
  );
}
