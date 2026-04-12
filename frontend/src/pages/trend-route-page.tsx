import DecisionSnapshotGrid from '../components/dashboard/DecisionSnapshotGrid';
import WeatherOutlookPanel from '../components/WeatherOutlookPanel';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  OverviewSignalsPayload,
  ProducePricesPayload,
  SensorData,
  WeatherOutlook,
} from '../types';
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
  overviewSignals: OverviewSignalsPayload | null;
}

export default function TrendRoutePage({
  crop,
  currentData,
  modelMetrics,
  history,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  produceLoading,
  overviewSignals,
}: TrendRoutePageProps) {
  return (
    <TrendPage
      weatherSurface={(
        <WeatherOutlookPanel
          weather={weather}
          loading={weatherLoading}
          error={weatherError}
        />
      )}
      marketSurface={(
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
