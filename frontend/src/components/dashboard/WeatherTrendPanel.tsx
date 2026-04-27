import { CloudRain, SunMedium, Thermometer, Wind } from 'lucide-react';
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
        eyebrow: 'Outside Weather',
        title: '대구 외기 운전 신호',
        description: '최고·최저기온, 강수 위험, 일사량, 풍속을 환기·보온 판단에 맞춰 비교합니다.',
        loading: '외기 예보 추세를 불러오는 중입니다...',
        unavailable: '외기 추세 데이터를 아직 표시할 수 없습니다.',
        maxTemp: '최고기온',
        minTemp: '최저기온',
        rainRisk: '강수확률',
        radiation: '일사량',
        wind: '최대풍속',
        source: '예보 소스',
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
          {weather?.source.provider ?? copy.source}
        </StatusChip>
      </header>

      {loading ? (
        <div className="mt-4 rounded-[var(--sg-radius-lg)] bg-[color:var(--sg-surface-raised)] p-8 text-center text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
          {copy.loading}
        </div>
      ) : error || trendRows.length === 0 ? (
        <div className="mt-4 rounded-[var(--sg-radius-lg)] bg-[color:var(--sg-surface-warm)] p-8 text-center text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
          {error ?? copy.unavailable}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
          <ChartFrame className="h-[22rem] rounded-[var(--sg-radius-lg)] bg-[color:var(--sg-surface-raised)] p-3 shadow-[var(--sg-shadow-card)]" minHeight={300}>
            {({ width, height }) => (
              <LineChart width={Math.max(width, 1)} height={Math.max(height, 300)} data={trendRows} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(89,107,74,0.14)" />
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
      )}
    </section>
  );
}
