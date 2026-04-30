import { CloudRain, MapPinned, SunMedium, Thermometer, Wind } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDate, formatLocaleDateTime } from '../../i18n/locale';
import type { WeatherOutlook } from '../../types';
import { getCountryLabel, getWeatherLabel } from '../../utils/displayCopy';
import ChartFrame from '../charts/ChartFrame';
import { StatusChip } from '../ui/status-chip';

interface WeatherTrendPanelProps {
  weather: WeatherOutlook | null;
  loading: boolean;
  error: string | null;
}

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 253, 249, 0.98)',
  border: '1px solid var(--sg-outline-soft)',
  borderRadius: '12px',
  boxShadow: 'var(--sg-shadow-card)',
} as const;

export default function WeatherTrendPanel({ weather, loading, error }: WeatherTrendPanelProps) {
  const { locale } = useLocale();
  const copy = locale === 'ko'
    ? {
        eyebrow: '외기 그래프',
        title: '대구 외기 운전 신호',
        description: '최고·최저기온, 강수 위험, 일사량, 풍속을 환기·보온 판단에 맞춰 비교합니다.',
        loading: '외기 예보 추세를 불러오는 중입니다...',
        unavailable: '외기 추세 데이터를 아직 표시할 수 없습니다.',
        maxTemp: '최고기온',
        minTemp: '최저기온',
        rainRisk: '강수확률',
        radiation: '일사량',
        wind: '최대풍속',
        currentLead: '지금 외기',
        feelsLike: '체감',
        humidity: '습도',
        clouds: '구름',
        sunshine: '일조',
        currentNarrative: '현재 외기, 습도, 바람, 일사 정보를 그래프와 한 패널 안에서 같이 봅니다.',
        source: '예보 자료',
      }
    : {
        eyebrow: 'Outside Weather',
        title: 'Daegu outside operating signals',
        description: 'Compare temperature, precipitation risk, radiation, and wind for venting and protection decisions.',
        loading: 'Loading outside trend...',
        unavailable: 'Outside trend data is not available yet.',
        maxTemp: 'Max temp',
        minTemp: 'Min temp',
        rainRisk: 'Rain risk',
        radiation: 'Radiation',
        wind: 'Wind max',
        currentLead: 'Current outside',
        feelsLike: 'Feels like',
        humidity: 'Humidity',
        clouds: 'Clouds',
        sunshine: 'Sunshine',
        currentNarrative: 'Current outside condition, humidity, wind, and radiation are integrated with the chart.',
        source: 'Forecast source',
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
  const today = weather?.daily[0];
  const providerLabel = weather?.source.provider ?? copy.source;
  const currentWeatherLabel = weather
    ? getWeatherLabel(weather.current.weather_code, weather.current.weather_label, locale)
    : '';

  return (
    <section className="sg-card sg-tint-neutral p-4 sm:p-5" aria-labelledby="weather-trend-title">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
          {locale === 'ko' ? copy.source : weather?.source.provider ?? copy.source}
        </StatusChip>
      </header>

      {loading ? (
        <div className="mt-4 rounded-[var(--sg-radius-lg)] bg-[color:var(--sg-surface-raised)] p-8 text-center text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
          {copy.loading}
        </div>
      ) : error || !weather || trendRows.length === 0 ? (
        <div className="mt-4 rounded-[var(--sg-radius-lg)] bg-[color:var(--sg-surface-warm)] p-8 text-center text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
          {error ?? copy.unavailable}
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <section
            className="rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-white/75 p-3 shadow-[var(--sg-shadow-card)]"
            aria-label={copy.currentLead}
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,0.88fr))]">
              <article className="rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-warm)] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-[color:var(--sg-color-olive)] shadow-[var(--sg-shadow-card)]">
                    <MapPinned className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="sg-eyebrow">{copy.currentLead}</p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="sg-data-number text-3xl font-bold text-[color:var(--sg-text-strong)]">
                        {weather.current.temperature_c.toFixed(1)}°C
                      </span>
                      <span className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{currentWeatherLabel}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                      {weather.location.name}, {getCountryLabel(weather.location.country, locale)} · {formatLocaleDateTime(locale, weather.current.time)}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-[color:var(--sg-color-olive)]">
                      {copy.feelsLike} {weather.current.apparent_temperature_c.toFixed(1)}°C · {providerLabel}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-muted)] p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-[color:var(--sg-text-faint)]">
                  <Thermometer className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
                  {copy.humidity} · {copy.clouds}
                </p>
                <p className="sg-data-number mt-3 text-xl font-bold text-[color:var(--sg-text-strong)]">
                  {weather.current.relative_humidity_pct.toFixed(0)}% · {weather.current.cloud_cover_pct.toFixed(0)}%
                </p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.currentNarrative}</p>
              </article>

              <article className="rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-tint-amber)] p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-[color:var(--sg-text-faint)]">
                  <Wind className="h-4 w-4 text-[color:var(--sg-accent-amber)]" aria-hidden="true" />
                  {copy.wind} · {copy.rainRisk}
                </p>
                <p className="sg-data-number mt-3 text-xl font-bold text-[color:var(--sg-text-strong)]">
                  {weather.current.wind_speed_kmh.toFixed(1)} km/h · {(today?.precipitation_probability_max_pct ?? 0).toFixed(0)}%
                </p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                  {copy.wind} {today?.wind_speed_max_kmh.toFixed(1) ?? '-'} km/h
                </p>
              </article>

              <article className="rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-tint-green)] p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-[color:var(--sg-text-faint)]">
                  <SunMedium className="h-4 w-4 text-[color:var(--sg-accent-forest)]" aria-hidden="true" />
                  {copy.radiation} · {copy.sunshine}
                </p>
                <p className="sg-data-number mt-3 text-xl font-bold text-[color:var(--sg-text-strong)]">
                  {(today?.shortwave_radiation_sum_mj_m2 ?? 0).toFixed(1)} MJ/m2
                </p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                  {copy.sunshine} {(today?.sunshine_duration_h ?? 0).toFixed(1)}h
                </p>
              </article>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.22fr)_minmax(280px,0.78fr)]">
            <ChartFrame className="h-[22rem] rounded-[var(--sg-radius-lg)] bg-[color:var(--sg-surface-raised)] p-3 shadow-[var(--sg-shadow-card)]" minHeight={300}>
              {({ width, height }) => (
                <BarChart width={Math.max(width, 1)} height={Math.max(height, 300)} data={trendRows} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(89,107,74,0.14)" />
                  <XAxis dataKey="label" stroke="var(--sg-text-faint)" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="temp" stroke="var(--sg-text-faint)" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="signal" orientation="right" stroke="var(--sg-text-faint)" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar yAxisId="temp" dataKey="maxTemp" name={`${copy.maxTemp} (C)`} fill="var(--sg-color-primary)" radius={[8, 8, 0, 0]} />
                  <Bar yAxisId="temp" dataKey="minTemp" name={`${copy.minTemp} (C)`} fill="var(--sg-color-olive)" radius={[8, 8, 0, 0]} />
                  <Bar yAxisId="signal" dataKey="rainRisk" name={`${copy.rainRisk} (%)`} fill="var(--sg-accent-amber)" radius={[8, 8, 0, 0]} />
                  <Bar yAxisId="signal" dataKey="radiation" name={`${copy.radiation} (MJ/m2)`} fill="var(--sg-color-success)" radius={[8, 8, 0, 0]} />
                  <Bar yAxisId="signal" dataKey="wind" name={`${copy.wind} (km/h)`} fill="var(--sg-color-sage)" radius={[8, 8, 0, 0]} />
                </BarChart>
              )}
            </ChartFrame>

            <div className="grid gap-3">
              {trendRows.slice(0, 4).map((row) => (
                <article key={row.date} className="sg-panel bg-[color:var(--sg-surface-raised)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="sg-eyebrow">{row.label}</p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--sg-text-strong)]">
                        {row.minTemp.toFixed(1)}-{row.maxTemp.toFixed(1)} C
                      </p>
                    </div>
                    <Thermometer className="h-4 w-4 text-[color:var(--sg-color-primary)]" aria-hidden="true" />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-[color:var(--sg-text-muted)]">
                    <div className="rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-muted)] p-2">
                      <dt className="flex items-center gap-1"><CloudRain className="h-3.5 w-3.5" /> {copy.rainRisk}</dt>
                      <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{row.rainRisk.toFixed(0)}%</dd>
                    </div>
                    <div className="rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-muted)] p-2">
                      <dt className="flex items-center gap-1"><SunMedium className="h-3.5 w-3.5" /> {copy.radiation}</dt>
                      <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{row.radiation.toFixed(1)}</dd>
                    </div>
                    <div className="rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-muted)] p-2">
                      <dt className="flex items-center gap-1"><Wind className="h-3.5 w-3.5" /> {copy.wind}</dt>
                      <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{row.wind.toFixed(1)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
