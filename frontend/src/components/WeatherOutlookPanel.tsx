import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDate, formatLocaleDateTime } from '../i18n/locale';
import { getCountryLabel, getWeatherLabel } from '../utils/displayCopy';
import type { WeatherOutlook } from '../types';
import DashboardCard from './common/DashboardCard';
import { StatusChip, type StatusChipTone } from './ui/status-chip';

interface WeatherOutlookPanelProps {
    weather: WeatherOutlook | null;
    loading: boolean;
    error: string | null;
    compact?: boolean;
}

function WeatherStatTile({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="min-w-0 rounded-[var(--sg-radius-md)] bg-white/84 px-3 py-2.5 shadow-[var(--sg-shadow-card)]">
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                {label}
            </div>
            <div className="sg-data-number mt-1 truncate text-sm font-bold text-[color:var(--sg-text-strong)]">
                {value}
            </div>
        </div>
    );
}

const WeatherOutlookPanel = ({ weather, loading, error, compact = false }: WeatherOutlookPanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            eyebrow: '외기와 예보',
            title: '대구 외기와 3일 예보',
            subtitle: '현재 외기와 3일 예보를 운영 판단 기준으로 묶었습니다.',
            loading: '대구 외기 정보를 불러오는 중입니다...',
            unavailable: '외기 정보를 아직 불러오지 못했습니다.',
            currentLead: '지금 외기',
            currentNarrative: '오늘 환기와 보수 운전의 기준이 되는 바깥 기상입니다.',
            feelsLike: '체감',
            summaryLive: '실시간 외기 연동 중입니다.',
            summaryCached: '실시간 외기 연결이 흔들려 최근 캐시를 기준으로 보여줍니다.',
            summaryFallback: '실시간 외기 연결이 없어 대체 예보를 기준으로 보여줍니다.',
            providerLive: '실시간',
            providerCached: '최근 캐시',
            providerFallback: '대체 예보',
            humidityClouds: '습도와 구름',
            humidityCloudsDetail: '상대습도와 운량을 함께 봅니다.',
            windRain: '바람과 강수',
            windRainDetail: '환기 손실과 비 예보를 함께 봅니다.',
            sunHours: '일사와 일조',
            sunHoursDetail: '복사량과 일조 시간을 함께 봅니다.',
            humidity: '습도',
            clouds: '구름',
            rainRisk: '강수 확률',
            shortwave: '단파복사',
            windMax: '최대 풍속',
            sunshine: '일조',
            forecastTitle: '3일 운영 요약',
            forecastBody: '환기 시점, 야간 보온, 작업 리듬에 바로 쓰는 외기 요약입니다.',
        }
        : {
            eyebrow: 'Outside signal',
            title: 'Daegu outside outlook',
            subtitle: 'Current conditions and the next 3 days, rewritten for today’s operating decisions.',
            loading: 'Loading Daegu outside outlook...',
            unavailable: 'Outside conditions are unavailable.',
            currentLead: 'Current outside signal',
            currentNarrative: 'The outside signal that should anchor today’s vent and protection posture.',
            feelsLike: 'Feels like',
            summaryLive: 'Live outside weather feed is connected.',
            summaryCached: 'The live feed is unstable, so the latest cached outside weather is shown.',
            summaryFallback: 'The live feed is unavailable, so a fallback outside outlook is shown.',
            providerLive: 'Live',
            providerCached: 'Cached',
            providerFallback: 'Fallback',
            humidityClouds: 'Humidity and clouds',
            humidityCloudsDetail: 'Relative humidity and cloud cover in one read.',
            windRain: 'Wind and rain',
            windRainDetail: 'Vent loss pressure and precipitation together.',
            sunHours: 'Radiation and sun',
            sunHoursDetail: 'Shortwave sum and sunshine duration together.',
            humidity: 'Humidity',
            clouds: 'Clouds',
            rainRisk: 'Rain risk',
            shortwave: 'Shortwave',
            windMax: 'Wind max',
            sunshine: 'Sunshine',
            forecastTitle: '3-day operating summary',
            forecastBody: 'A compact outside signal for vent timing, night protection, and work rhythm.',
        };

    const today = weather?.daily[0];
    const providerLabel = weather?.source.provider ?? 'Open-Meteo';
    const providerKey = providerLabel.toLowerCase();
    const isCachedFallback = providerKey.includes('cached');
    const isSyntheticFallback = providerKey.includes('fallback');
    const providerDisplayLabel = isCachedFallback
        ? copy.providerCached
        : isSyntheticFallback
            ? copy.providerFallback
            : copy.providerLive;
    const providerNarrative = isCachedFallback
        ? copy.summaryCached
        : isSyntheticFallback
            ? copy.summaryFallback
            : copy.summaryLive;
    const providerStatusTone: StatusChipTone = isSyntheticFallback
        ? 'warning'
        : isCachedFallback
            ? 'stable'
            : 'growth';
    const currentWeatherLabel = weather
        ? getWeatherLabel(weather.current.weather_code, weather.current.weather_label, locale)
        : '';
    const localizedSummary = weather && locale === 'ko'
        ? `지금 ${weather.current.temperature_c.toFixed(1)}°C, 체감 ${weather.current.apparent_temperature_c.toFixed(1)}°C입니다. 오늘은 비 가능성 ${(today?.precipitation_probability_max_pct ?? 0).toFixed(0)}%, 최대 풍속 ${(today?.wind_speed_max_kmh ?? 0).toFixed(1)} km/h를 함께 봅니다.`
        : weather?.summary ?? '';

    const forecastCards = compact ? [] : weather?.daily.slice(0, 3) ?? [];
    const formatForecastLabel = (date: string): string =>
        formatLocaleDate(locale, `${date}T00:00:00`, { month: 'short', day: 'numeric', weekday: 'short' });

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={weather ? `${weather.location.name}, ${getCountryLabel(weather.location.country, locale)}` : copy.title}
            description={!compact ? copy.subtitle : undefined}
            className="sg-tint-blue"
            actions={(
                <StatusChip tone={providerStatusTone} data-testid="weather-provider-status-chip">
                    {providerDisplayLabel}
                </StatusChip>
            )}
        >
            {loading ? (
                <div
                    className="rounded-[var(--sg-radius-xl)] bg-white/82 px-5 py-12 text-center text-sm text-[color:var(--sg-text-muted)]"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    {copy.loading}
                </div>
            ) : error || !weather ? (
                <div className="rounded-[var(--sg-radius-xl)] bg-[color:var(--sg-tint-amber)] px-5 py-12 text-center text-sm text-[color:var(--sg-accent-amber)]">
                    {copy.unavailable}
                </div>
            ) : (
                <div className="flex h-full flex-col gap-3">
                    <section
                        className="rounded-[var(--sg-radius-lg)] bg-white/78 px-4 py-3"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span className="sg-eyebrow">{copy.currentLead}</span>
                                <span className="sg-data-number text-2xl font-bold leading-none text-[color:var(--sg-text-strong)]">
                                    {weather.current.temperature_c.toFixed(1)}°C
                                </span>
                                <span className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                    {currentWeatherLabel}
                                </span>
                                <span className="text-xs text-[color:var(--sg-text-muted)]">
                                    {copy.feelsLike} {weather.current.apparent_temperature_c.toFixed(1)}°C
                                </span>
                            </div>
                            <div className="text-right text-[11px] text-[color:var(--sg-text-muted)]">
                                {formatLocaleDateTime(locale, weather.current.time)} · {weather.location.timezone}
                            </div>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                            {localizedSummary} {providerNarrative}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                            <WeatherStatTile
                                label={copy.humidity}
                                value={`${weather.current.relative_humidity_pct.toFixed(0)}%`}
                            />
                            <WeatherStatTile
                                label={copy.clouds}
                                value={`${weather.current.cloud_cover_pct.toFixed(0)}%`}
                            />
                            <WeatherStatTile
                                label={copy.windMax}
                                value={`${weather.current.wind_speed_kmh.toFixed(1)} km/h`}
                            />
                            <WeatherStatTile
                                label={copy.rainRisk}
                                value={`${(today?.precipitation_probability_max_pct ?? 0).toFixed(0)}%`}
                            />
                            <WeatherStatTile
                                label={copy.shortwave}
                                value={`${(today?.shortwave_radiation_sum_mj_m2 ?? 0).toFixed(1)} MJ/m2`}
                            />
                            <WeatherStatTile
                                label={copy.sunshine}
                                value={`${(today?.sunshine_duration_h ?? 0).toFixed(1)}h`}
                            />
                        </div>
                    </section>

                    {forecastCards.length > 0 ? (
                        <section
                            className="rounded-[var(--sg-radius-xl)] bg-white/76 px-5 py-5"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="sg-eyebrow">{copy.forecastTitle}</div>
                                    <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                                        {copy.forecastBody}
                                    </p>
                                </div>
                                <StatusChip tone="stable">
                                    {locale === 'ko' ? `${forecastCards.length}일 요약` : `${forecastCards.length}-day summary`}
                                </StatusChip>
                            </div>

                            <div className="mt-5 grid gap-3 xl:grid-cols-3">
                                {forecastCards.map((day) => (
                                    <article
                                        key={day.date}
                                        className="rounded-[var(--sg-radius-lg)] bg-[color:var(--sg-surface-strong)] px-4 py-4"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                                    {formatForecastLabel(day.date)}
                                                </div>
                                                <div className="mt-1 text-xs text-[color:var(--sg-text-muted)]">
                                                    {getWeatherLabel(day.weather_code, day.weather_label, locale)}
                                                </div>
                                            </div>
                                            <div className="sg-data-number text-right text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                                {day.temperature_max_c.toFixed(1)}° / {day.temperature_min_c.toFixed(1)}°
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                            <div className="rounded-[var(--sg-radius-md)] bg-[color:var(--sg-tint-blue)] px-3 py-3">
                                                <div className="text-[color:var(--sg-text-faint)]">{copy.rainRisk}</div>
                                                <div className="sg-data-number mt-1 font-semibold text-[color:var(--sg-text-strong)]">
                                                    {day.precipitation_probability_max_pct.toFixed(0)}%
                                                </div>
                                            </div>
                                            <div className="rounded-[var(--sg-radius-md)] bg-[color:var(--sg-tint-neutral)] px-3 py-3">
                                                <div className="text-[color:var(--sg-text-faint)]">{copy.shortwave}</div>
                                                <div className="sg-data-number mt-1 font-semibold text-[color:var(--sg-text-strong)]">
                                                    {day.shortwave_radiation_sum_mj_m2.toFixed(1)} MJ/m2
                                                </div>
                                            </div>
                                            <div className="rounded-[var(--sg-radius-md)] bg-[color:var(--sg-tint-violet)] px-3 py-3">
                                                <div className="text-[color:var(--sg-text-faint)]">{copy.windMax}</div>
                                                <div className="sg-data-number mt-1 font-semibold text-[color:var(--sg-text-strong)]">
                                                    {day.wind_speed_max_kmh.toFixed(1)} km/h
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            )}
        </DashboardCard>
    );
};

export default WeatherOutlookPanel;
