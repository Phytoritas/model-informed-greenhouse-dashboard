import DecisionSnapshotGrid from '../components/dashboard/DecisionSnapshotGrid';
import WeatherOutlookPanel from '../components/WeatherOutlookPanel';
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
}: TrendRoutePageProps) {
  return (
    <TrendPage
      locale={locale}
      weatherSurface={(
        <div className="grid gap-5">
          <WeatherTrendPanel
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
          />
          <WeatherOutlookPanel
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
            compact
          />
        </div>
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
      weatherUnavailable={Boolean(weatherError)}
      marketUnavailable={Boolean(produceError)}
    />
  );
}
