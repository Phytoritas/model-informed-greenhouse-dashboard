import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import type { WeatherOutlook } from '../../types';
import WeatherTrendPanel from './WeatherTrendPanel';

const weatherPayload: WeatherOutlook = {
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
  summary: 'Clear and warm',
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
  daily: [
    {
      date: '2026-04-25',
      weather_code: 0,
      weather_label: 'Clear',
      temperature_max_c: 24.2,
      temperature_min_c: 13.4,
      shortwave_radiation_sum_mj_m2: 18.6,
      precipitation_probability_max_pct: 12,
      precipitation_sum_mm: 0,
      wind_speed_max_kmh: 14.2,
      sunshine_duration_h: 8.4,
    },
    {
      date: '2026-04-26',
      weather_code: 61,
      weather_label: 'Rain',
      temperature_max_c: 21.2,
      temperature_min_c: 12.8,
      shortwave_radiation_sum_mj_m2: 10.1,
      precipitation_probability_max_pct: 72,
      precipitation_sum_mm: 3.2,
      wind_speed_max_kmh: 18.5,
      sunshine_duration_h: 4.1,
    },
  ],
};

describe('WeatherTrendPanel', () => {
  beforeEach(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  });

  it('renders forecast summary values as an R4 metric tile row and keeps the chart in an sg-panel card', () => {
    render(
      <LocaleProvider>
        <WeatherTrendPanel weather={weatherPayload} loading={false} error={null} />
      </LocaleProvider>,
    );

    const metricRow = screen.getByTestId('weather-summary-metric-row');
    expect(metricRow.className.includes('overview-card-row-4')).toBe(true);
    expect(screen.getByText('Current temp')).toBeTruthy();
    expect(screen.getByText('Today range')).toBeTruthy();
    expect(screen.getByText('Peak rain risk')).toBeTruthy();
    expect(screen.getByText('Today radiation')).toBeTruthy();

    const chartCard = screen.getByTestId('weather-trend-chart-card');
    expect(chartCard.className.includes('sg-panel')).toBe(true);
    expect(screen.getByText('3-day outside trend')).toBeTruthy();
  });

  it('keeps the loading state from the weather hook surface without assuming forecast data exists', () => {
    render(
      <LocaleProvider>
        <WeatherTrendPanel weather={null} loading error={null} />
      </LocaleProvider>,
    );

    expect(screen.getByText('Loading outside trend...')).toBeTruthy();
    expect(screen.queryByTestId('weather-summary-metric-row')).toBeNull();
  });

  it('keeps the error state from the weather hook surface without rendering summary metrics', () => {
    render(
      <LocaleProvider>
        <WeatherTrendPanel weather={null} loading={false} error="weather backend delayed" />
      </LocaleProvider>,
    );

    expect(screen.getByText('weather backend delayed')).toBeTruthy();
    expect(screen.queryByTestId('weather-summary-metric-row')).toBeNull();
    expect(screen.queryByTestId('weather-trend-chart-card')).toBeNull();
  });
});
