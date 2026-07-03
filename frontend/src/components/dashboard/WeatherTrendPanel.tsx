import { CloudRain, SunMedium, Thermometer } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDate } from '../../i18n/locale';
import type { WeatherOutlook } from '../../types';
import ChartFrame from '../charts/ChartFrame';
import { MetricCard } from '../ui/metric-card';
import { StatusChip } from '../ui/status-chip';

interface WeatherTrendPanelProps {
  weather: WeatherOutlook | null;
  loading: boolean;
  error: string | null;
}

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--sg-surface-raised)',
  border: '1px solid var(--sg-outline-soft)',
  borderRadius: 'var(--sg-radius-lg)',
  boxShadow: 'var(--sg-shadow-card)',
} as const;

export default function WeatherTrendPanel({ weather, loading, error }: WeatherTrendPanelProps) {
  const { locale } = useLocale();
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Weather Trend',
        title: '대구 외기 추세 그래프',
        description: '최고·최저기온, 강수 위험, 일사량, 풍속을 한 화면에서 비교합니다.',
        loading: '외기 예보 추세를 불러오는 중입니다...',
        unavailable: '외기 추세 데이터를 아직 표시할 수 없습니다.',
        maxTemp: '최고기온',
        minTemp: '최저기온',
        currentTemp: '현재 기온',
        todayRange: '오늘 범위',
        peakRainRisk: '최대 강수확률',
        todayRadiation: '오늘 일사량',
        rainRisk: '강수확률',
        radiation: '일사량',
        wind: '최대풍속',
        source: '예보 소스',
        chartTitle: '3일 외기 추세',
        chartDetail: '온도·강수·일사량을 같은 카드에서 비교합니다.',
      }
    : {
        eyebrow: 'Weather Trend',
        title: 'Daegu outside trend chart',
        description: 'Compare temperature, precipitation risk, radiation, and wind on the same lane.',
        loading: 'Loading outside trend...',
        unavailable: 'Outside trend data is not available yet.',
        maxTemp: 'Max temp',
        minTemp: 'Min temp',
        currentTemp: 'Current temp',
        todayRange: 'Today range',
        peakRainRisk: 'Peak rain risk',
        todayRadiation: 'Today radiation',
        rainRisk: 'Rain risk',
        radiation: 'Radiation',
        wind: 'Wind max',
        source: 'Forecast source',
        chartTitle: '3-day outside trend',
        chartDetail: 'Temperature, rain risk, and radiation stay in one chart card.',
      };

  const trendRows = weather?.daily.map((day) => ({
    date: day.date,
    label: formatLocaleDate(locale, `${day.date}T00:00:00`, { month: 'short', day: 'numeric' }),
    maxTemp: day.temperature_max_c,
    minTemp: day.temperature_min_c,
    rainRisk: day.precipitation_probability_max_pct,
    radiation: day.shortwave_radiation_sum_mj_m2,
    wind: day.wind_speed_max_kmh,
  })) ?? [];

  const firstForecast = trendRows[0] ?? null;
  const maxRainRisk = trendRows.length > 0
    ? Math.max(...trendRows.map((row) => row.rainRisk))
    : null;
  const maxWind = trendRows.length > 0
    ? Math.max(...trendRows.map((row) => row.wind))
    : null;

  return (
    <section className="sg-panel bg-[color:var(--sg-surface-raised)] p-4" aria-labelledby="weather-trend-title">
      <header className="flex flex-col gap-3 border-b border-[color:var(--sg-outline-soft)] pb-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="sg-eyebrow">{copy.eyebrow}</p>
          <h2 id="weather-trend-title" className="mt-1 text-xl font-bold text-[color:var(--sg-text-strong)]">
            {copy.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--sg-text-muted)]">
            {copy.description}
          </p>
        </div>
        <StatusChip tone={weather ? 'stable' : loading ? 'warning' : 'muted'}>
          {weather?.source.provider ?? copy.source}
        </StatusChip>
      </header>

      {loading ? (
        <div className="mt-4 rounded-[var(--sg-radius-md)] bg-white p-8 text-center text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
          {copy.loading}
        </div>
      ) : error || !weather || trendRows.length === 0 ? (
        <div className="mt-4 rounded-[var(--sg-radius-md)] bg-[color:var(--sg-surface-warm)] p-8 text-center text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
          {error ?? copy.unavailable}
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="overview-card-row-4" data-testid="weather-summary-metric-row">
            <MetricCard
              label={copy.currentTemp}
              value={weather.current.temperature_c.toFixed(1)}
              unit="C"
              detail={weather.current.weather_label}
              icon={Thermometer}
              trendLabel={weather.location.name}
            />
            <MetricCard
              label={copy.todayRange}
              value={firstForecast ? `${firstForecast.minTemp.toFixed(1)}-${firstForecast.maxTemp.toFixed(1)}` : '-'}
              unit="C"
              detail={firstForecast?.label ?? weather.location.timezone}
              icon={Thermometer}
              trendLabel={copy.maxTemp}
            />
            <MetricCard
              label={copy.peakRainRisk}
              value={maxRainRisk === null ? '-' : maxRainRisk.toFixed(0)}
              unit="%"
              detail={copy.rainRisk}
              icon={CloudRain}
              tone={maxRainRisk !== null && maxRainRisk >= 60 ? 'warning' : 'stable'}
              trend={maxRainRisk !== null && maxRainRisk >= 60 ? 'up' : 'stable'}
              trendLabel={maxWind === null ? copy.wind : `${copy.wind} ${maxWind.toFixed(1)} km/h`}
            />
            <MetricCard
              label={copy.todayRadiation}
              value={firstForecast ? firstForecast.radiation.toFixed(1) : '-'}
              unit="MJ/m2"
              detail={firstForecast ? `${copy.wind} ${firstForecast.wind.toFixed(1)} km/h` : copy.radiation}
              icon={SunMedium}
              trendLabel={copy.radiation}
            />
          </div>

          <article className="sg-panel min-w-0 bg-white p-3" data-testid="weather-trend-chart-card">
            <div className="mb-3 flex flex-col gap-2 border-b border-[color:var(--sg-outline-soft)] pb-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-[color:var(--sg-text-strong)]">{copy.chartTitle}</h3>
                <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.chartDetail}</p>
              </div>
              <StatusChip tone="stable">{weather.source.fetched_at.slice(0, 10)}</StatusChip>
            </div>
            <ChartFrame className="h-[22rem]" minHeight={300}>
              {({ width, height }) => (
                <LineChart width={Math.max(width, 1)} height={Math.max(height, 300)} data={trendRows} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--sg-outline-strong)" />
                  <XAxis dataKey="label" stroke="var(--sg-text-faint)" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="temp" stroke="var(--sg-text-faint)" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="percent" orientation="right" stroke="var(--sg-text-faint)" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Line yAxisId="temp" type="monotone" dataKey="maxTemp" name={`${copy.maxTemp} (C)`} stroke="var(--sg-color-primary)" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="temp" type="monotone" dataKey="minTemp" name={`${copy.minTemp} (C)`} stroke="var(--sg-color-olive)" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="percent" type="monotone" dataKey="rainRisk" name={`${copy.rainRisk} (%)`} stroke="var(--sg-accent-amber)" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="temp" type="monotone" dataKey="radiation" name={`${copy.radiation} (MJ/m2)`} stroke="var(--sg-color-success)" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              )}
            </ChartFrame>
          </article>
        </div>
      )}
    </section>
  );
}
