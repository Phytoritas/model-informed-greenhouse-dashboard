import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import type {
  AdvancedModelMetrics,
  OverviewSignalsPayload,
  ProducePricesPayload,
  SensorData,
  WeatherOutlook,
} from '../../types';
import DecisionSnapshotGrid from './DecisionSnapshotGrid';

const sensorPoint = (timestamp: number, photosynthesis: number, energyUsage: number): SensorData => ({
  timestamp,
  temperature: 22.4,
  canopyTemp: 22.1,
  humidity: 67,
  co2: 540,
  light: 410,
  soilMoisture: 48,
  vpd: 1.12,
  transpiration: 2.4,
  stomatalConductance: 0.34,
  photosynthesis,
  hFlux: 44,
  leFlux: 92,
  energyUsage,
});

const currentData = sensorPoint(Date.parse('2026-04-25T09:00:00+09:00'), 16.8, 12.4);

const modelMetrics: AdvancedModelMetrics = {
  cropType: 'Cucumber',
  growth: {
    lai: 3.2,
    biomass: 124.5,
    developmentStage: 'vegetative',
    growthRate: 1.4,
  },
  yield: {
    predictedWeekly: 126.5,
    confidence: 0.82,
    harvestableFruits: 48,
  },
  energy: {
    consumption: 12.4,
    costPrediction: 3800,
    efficiency: 3.18,
  },
};

const weather: WeatherOutlook = {
  location: {
    name: 'Daegu',
    country: 'KR',
    latitude: 35.87,
    longitude: 128.6,
    timezone: 'Asia/Seoul',
  },
  source: {
    provider: 'Open-Meteo',
    docs_url: 'https://example.test/open-meteo',
    fetched_at: '2026-04-25T09:00:00+09:00',
  },
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
    retail: {
      market_key: 'retail',
      market_label: 'Retail',
      summary: 'Retail',
      items: [],
    },
    wholesale: {
      market_key: 'wholesale',
      market_label: 'Wholesale',
      summary: 'Wholesale',
      items: [
        {
          key: 'cucumber-wholesale',
          display_name: 'Cucumber Baekdadagi',
          source_name: 'KAMIS',
          category_name: 'Vegetables',
          market_label: 'Wholesale',
          unit: 'kg',
          latest_day: '2026-04-25',
          current_price_krw: 4200,
          previous_day_price_krw: 4100,
          month_ago_price_krw: 3900,
          year_ago_price_krw: 3700,
          direction: 'up',
          day_over_day_pct: 2.4,
          raw_day_over_day_pct: 2.4,
        },
      ],
    },
  },
  trend: {
    market_key: 'wholesale',
    reference_date: '2026-04-25',
    history_days: 14,
    forecast_days: 7,
    normal_year_windows: [3, 5, 10],
    series: [
      {
        key: 'cucumber-wholesale',
        display_name: 'Cucumber Baekdadagi',
        source_name: 'KAMIS',
        unit: 'kg',
        reference_date: '2026-04-25',
        history_days: 14,
        forecast_days: 7,
        points: [
          {
            date: '2026-04-19',
            segment: 'history',
            actual_price_krw: 3900,
            normal_3y_price_krw: null,
            normal_5y_price_krw: null,
            normal_10y_price_krw: null,
            normal_3y_sample_count: 0,
            normal_5y_sample_count: 0,
            normal_10y_sample_count: 0,
          },
          {
            date: '2026-04-25',
            segment: 'history',
            actual_price_krw: 4200,
            normal_3y_price_krw: null,
            normal_5y_price_krw: null,
            normal_10y_price_krw: null,
            normal_3y_sample_count: 0,
            normal_5y_sample_count: 0,
            normal_10y_sample_count: 0,
          },
        ],
      },
    ],
    unavailable_series: [],
  },
};

const overviewSignals: OverviewSignalsPayload = {
  status: 'success',
  crop: 'cucumber',
  greenhouse_id: 'cucumber',
  window_hours: 72,
  irradiance: {
    source: { provider: 'Open-Meteo' },
    unit: 'W/m²',
    points: [
      { time: '2026-04-25T08:00:00+09:00', shortwave_radiation_w_m2: 280 },
      { time: '2026-04-25T09:00:00+09:00', shortwave_radiation_w_m2: 410 },
    ],
  },
  source_sink: {
    source: { provider: 'Model runtime snapshots' },
    unit: 'index',
    status: 'ready',
    points: [],
  },
};

describe('DecisionSnapshotGrid', () => {
  beforeEach(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ko');
  });

  it('renders decision snapshots as command-style bridge cards with icons, summary values, and bottom action/context chips', () => {
    render(
      <LocaleProvider>
        <DecisionSnapshotGrid
          crop="Cucumber"
          currentData={currentData}
          modelMetrics={modelMetrics}
          weather={weather}
          weatherLoading={false}
          producePrices={producePrices}
          produceLoading={false}
          history={[
            sensorPoint(Date.parse('2026-04-25T08:00:00+09:00'), 14.2, 11.8),
            currentData,
          ]}
          overviewSignals={overviewSignals}
        />
      </LocaleProvider>,
    );

    expect(screen.getByTestId('decision-bridge-card-weather').className.includes('sg-panel')).toBe(true);
    expect(screen.getByTestId('decision-bridge-card-market').className.includes('sg-panel')).toBe(true);
    expect(screen.getByText('17.8')).toBeTruthy();
    expect(screen.getByText('4,200')).toBeTruthy();
    expect(screen.getByText('환기 확인')).toBeTruthy();
    expect(screen.getByText('외기 일사')).toBeTruthy();
    expect(screen.getByText('출하 판단')).toBeTruthy();
    expect(screen.getByText('도매 기준')).toBeTruthy();
  });

  it('preserves bridge card loading context when weather, produce, and overview signal data are unavailable', () => {
    render(
      <LocaleProvider>
        <DecisionSnapshotGrid
          crop="Cucumber"
          currentData={currentData}
          modelMetrics={modelMetrics}
          weather={null}
          weatherLoading
          producePrices={null}
          produceLoading
          history={[]}
          overviewSignals={null}
        />
      </LocaleProvider>,
    );

    expect(screen.getByTestId('decision-bridge-card-weather').className.includes('sg-panel')).toBe(true);
    expect(screen.getByTestId('decision-bridge-card-market').className.includes('sg-panel')).toBe(true);
    expect(screen.getByText(/외기 정보 불러오는 중/)).toBeTruthy();
    expect(screen.getByText(/도매 시세 대기 중/)).toBeTruthy();
    expect(screen.getByText('환기 확인')).toBeTruthy();
    expect(screen.getByText('출하 판단')).toBeTruthy();
  });
});
