import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import type {
  AdvancedModelMetrics,
  ProducePricesPayload,
  SensorData,
  WeatherOutlook,
} from '../../types';
import ResourcesCommandCenter from './ResourcesCommandCenter';

const currentData: SensorData = {
  timestamp: Date.parse('2026-04-25T09:00:00+09:00'),
  temperature: 22.4,
  canopyTemp: 22.1,
  humidity: 67,
  co2: 540,
  light: 410,
  soilMoisture: 48,
  vpd: 1.12,
  transpiration: 2.4,
  stomatalConductance: 0.34,
  photosynthesis: 16.8,
  hFlux: 44,
  leFlux: 92,
  energyUsage: 12.4,
};

const modelMetrics: AdvancedModelMetrics = {
  cropType: 'Cucumber',
  growth: { lai: 3.2, biomass: 124.5, developmentStage: 'vegetative', growthRate: 1.4 },
  yield: { predictedWeekly: 126.5, confidence: 0.82, harvestableFruits: 48 },
  energy: { consumption: 12.4, costPrediction: 3800, efficiency: 3.18 },
};

const weather: WeatherOutlook = {
  location: { name: 'Daegu', country: 'KR', latitude: 35.87, longitude: 128.6, timezone: 'Asia/Seoul' },
  source: { provider: 'Open-Meteo', docs_url: 'https://example.test/open-meteo', fetched_at: '2026-04-25T09:00:00+09:00' },
  summary: 'Clear',
  current: {
    time: '2026-04-25T09:00:00+09:00',
    weather_code: 0,
    weather_label: 'Clear',
    temperature_c: 17.8,
    apparent_temperature_c: 17.1,
    relative_humidity_pct: 58,
    precipitation_mm: 0,
    cloud_cover_pct: 12,
    wind_speed_kmh: 8.4,
    wind_direction_deg: 240,
    is_day: true,
  },
  daily: [],
};

const producePrices: ProducePricesPayload = {
  source: {
    provider: 'KAMIS',
    docs_url: 'https://example.test/kamis',
    endpoint: '/market/produce',
    auth_mode: 'configured',
    fetched_at: '2026-04-25T09:00:00+09:00',
    latest_day: '2026-04-25',
  },
  summary: 'KAMIS snapshot',
  items: [],
  markets: {
    retail: { market_key: 'retail', market_label: 'Retail', summary: 'Retail', items: [] },
    wholesale: { market_key: 'wholesale', market_label: 'Wholesale', summary: 'Wholesale', items: [] },
  },
  trend: {
    market_key: 'wholesale',
    reference_date: '2026-04-25',
    history_days: 14,
    forecast_days: 7,
    normal_year_windows: [3, 5, 10],
    series: [],
    unavailable_series: [],
  },
};

function renderResources(activePanel: 'resources-energy' | 'resources-market' | 'resources-stock') {
  return render(
    <LocaleProvider>
      <ResourcesCommandCenter
        locale="ko"
        crop="Cucumber"
        cropLabel="오이"
        currentData={currentData}
        modelMetrics={modelMetrics}
        weather={weather}
        weatherLoading={false}
        weatherError={null}
        producePrices={producePrices}
        produceLoading={false}
        produceError={null}
        activePanel={activePanel}
      />
    </LocaleProvider>,
  );
}

describe('PRD-006 ResourcesCommandCenter panel dedup (R19/R20)', () => {
  beforeEach(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ko');
  });

  it('verify_src001_s0006_r003_a01 keeps DecisionSnapshotGrid on the nutrient sub-tab as its decision snapshot', () => {
    renderResources('resources-stock');

    // R20: the shared DecisionSnapshotGrid data path survives at its /resources home.
    expect(screen.getByTestId('decision-bridge-card-weather')).toBeTruthy();
    expect(screen.getByTestId('decision-bridge-card-market')).toBeTruthy();
    expect(screen.getByTestId('decision-bridge-card-energy')).toBeTruthy();
    expect(screen.getByTestId('decision-bridge-card-crop')).toBeTruthy();
  });

  it('verify_src001_s0006_r002_a01 drops the redundant DecisionSnapshotGrid from the energy sub-tab', () => {
    renderResources('resources-energy');

    // R19: the energy sub-tab no longer double-renders the decision snapshot;
    // the always-present hero summary cards already carry those four signals.
    expect(screen.queryByTestId('decision-bridge-card-weather')).toBeNull();
    expect(screen.queryByTestId('decision-bridge-card-market')).toBeNull();
    expect(screen.queryByTestId('decision-bridge-card-energy')).toBeNull();
    expect(screen.queryByTestId('decision-bridge-card-crop')).toBeNull();
  });
});
