import { MapPinned, SunMedium, Thermometer, Wind } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDate, formatLocaleDateTime } from '../i18n/locale';
import { getCountryLabel, getWeatherLabel } from '../utils/displayCopy';
import type { WeatherOutlook } from '../types';
import DashboardCard from './common/DashboardCard';

interface WeatherOutlookPanelProps {
    weather: WeatherOutlook | null;
    loading: boolean;
    error: string | null;
    compact?: boolean;
}

function WeatherSignalTile({
    icon: Icon,
    label,
    value,
    detail,
    tone,
}: {
    icon: typeof Thermometer;
    label: string;
    value: string;
    detail: string;
    tone: 'blue' | 'amber' | 'violet';
}) {
    const toneClass = {
        blue: 'sg-tint-blue text-[color:var(--sg-accent-blue)]',
        amber: 'sg-tint-amber text-[color:var(--sg-accent-amber)]',
        violet: 'sg-tint-violet text-[color:var(--sg-accent-violet)]',
    }[tone];

    return (
        <article
            className={`relative overflow-hidden rounded-[24px] px-4 py-4 ${toneClass}`}
            style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
            <div className="absolute right-3 top-3 h-16 w-16 rounded-full bg-white/18 blur-2xl" />
            <div className="relative flex items-start gap-3">
                <div
                    className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/84"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="sg-eyebrow">{label}</div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]">
                        {value}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                        {detail}
                    </p>
                </div>
            </div>
        </article>
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
                <div
                    className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-blue)]"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    {providerDisplayLabel}
                </div>
            )}
        >
            {loading ? (
                <div
                    className="rounded-[28px] bg-white/82 px-5 py-12 text-center text-sm text-[color:var(--sg-text-muted)]"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    {copy.loading}
                </div>
            ) : error || !weather ? (
                <div className="rounded-[28px] bg-[color:var(--sg-tint-amber)] px-5 py-12 text-center text-sm text-[color:var(--sg-accent-amber)]">
                    {copy.unavailable}
                </div>
            ) : (
                <div className="flex h-full flex-col gap-4">
                    <div className={`grid gap-4 ${compact ? 'xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]' : 'xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]'}`}>
                        <article
                            className="relative overflow-hidden rounded-[32px] px-5 py-5"
                            style={{
                                background: 'linear-gradient(135deg, rgba(196,231,255,0.94), rgba(255,255,255,0.88))',
                                boxShadow: 'var(--sg-shadow-soft)',
                            }}
                        >
                            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/24 blur-3xl" />
                            <div className="relative flex h-full flex-col gap-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/84"
                                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                        >
                                            <MapPinned className="h-5.5 w-5.5 text-[color:var(--sg-accent-blue)]" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="sg-eyebrow">{copy.currentLead}</div>
                                            <div className="mt-3 text-[clamp(2.2rem,2rem+1vw,3.4rem)] font-semibold tracking-[-0.07em] text-[color:var(--sg-text-strong)]">
                                                {weather.current.temperature_c.toFixed(1)}°C
                                            </div>
                                            <div className="mt-2 text-base font-semibold text-[color:var(--sg-text-strong)]">
                                                {currentWeatherLabel}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        className="rounded-[22px] bg-white/82 px-4 py-3 text-right text-xs text-[color:var(--sg-text-muted)]"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        <div>{formatLocaleDateTime(locale, weather.current.time)}</div>
                                        <div className="mt-1 font-medium text-[color:var(--sg-text-strong)]">{weather.location.timezone}</div>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                                    <div>
                                        <p className="max-w-3xl text-sm leading-7 text-[color:var(--sg-text-muted)]">
                                            {localizedSummary}
                                        </p>
                                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--sg-accent-blue)]">
                                            {copy.currentNarrative}
                                        </p>
                                    </div>
                                    <div
                                        className="rounded-[24px] bg-white/84 px-4 py-4"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        <div className="sg-eyebrow">{providerDisplayLabel}</div>
                                        <div className="mt-3 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                            {copy.feelsLike} {weather.current.apparent_temperature_c.toFixed(1)}°C
                                        </div>
                                        <p className="mt-2 text-xs leading-6 text-[color:var(--sg-text-muted)]">
                                            {providerNarrative}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </article>

                        <div className="grid gap-4">
                            <WeatherSignalTile
                                icon={Thermometer}
                                label={copy.humidityClouds}
                                value={`${copy.humidity} ${weather.current.relative_humidity_pct.toFixed(0)}% · ${copy.clouds} ${weather.current.cloud_cover_pct.toFixed(0)}%`}
                                detail={copy.humidityCloudsDetail}
                                tone="blue"
                            />
                            <WeatherSignalTile
                                icon={Wind}
                                label={copy.windRain}
                                value={`${weather.current.wind_speed_kmh.toFixed(1)} km/h · ${copy.rainRisk} ${(today?.precipitation_probability_max_pct ?? 0).toFixed(0)}%`}
                                detail={copy.windRainDetail}
                                tone="amber"
                            />
                            <WeatherSignalTile
                                icon={SunMedium}
                                label={copy.sunHours}
                                value={`${(today?.shortwave_radiation_sum_mj_m2 ?? 0).toFixed(1)} MJ/m2 · ${copy.sunshine} ${(today?.sunshine_duration_h ?? 0).toFixed(1)}h`}
                                detail={copy.sunHoursDetail}
                                tone="violet"
                            />
                        </div>
                    </div>

                    {forecastCards.length > 0 ? (
                        <section
                            className="rounded-[30px] bg-white/76 px-5 py-5"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="sg-eyebrow">{copy.forecastTitle}</div>
                                    <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                                        {copy.forecastBody}
                                    </p>
                                </div>
                                <div className="rounded-full bg-[color:var(--sg-tint-blue)] px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-blue)]">
                                    {locale === 'ko' ? `${forecastCards.length}일 요약` : `${forecastCards.length}-day summary`}
                                </div>
                            </div>

                            <div className="mt-5 grid gap-3 xl:grid-cols-3">
                                {forecastCards.map((day) => (
                                    <article
                                        key={day.date}
                                        className="rounded-[24px] bg-[color:var(--sg-surface-strong)] px-4 py-4"
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
                                            <div className="text-right text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                                {day.temperature_max_c.toFixed(1)}° / {day.temperature_min_c.toFixed(1)}°
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                            <div className="rounded-[16px] bg-[color:var(--sg-tint-blue)] px-3 py-3">
                                                <div className="text-[color:var(--sg-text-faint)]">{copy.rainRisk}</div>
                                                <div className="mt-1 font-semibold text-[color:var(--sg-text-strong)]">
                                                    {day.precipitation_probability_max_pct.toFixed(0)}%
                                                </div>
                                            </div>
                                            <div className="rounded-[16px] bg-[color:var(--sg-tint-neutral)] px-3 py-3">
                                                <div className="text-[color:var(--sg-text-faint)]">{copy.shortwave}</div>
                                                <div className="mt-1 font-semibold text-[color:var(--sg-text-strong)]">
                                                    {day.shortwave_radiation_sum_mj_m2.toFixed(1)} MJ/m2
                                                </div>
                                            </div>
                                            <div className="rounded-[16px] bg-[color:var(--sg-tint-violet)] px-3 py-3">
                                                <div className="text-[color:var(--sg-text-faint)]">{copy.windMax}</div>
                                                <div className="mt-1 font-semibold text-[color:var(--sg-text-strong)]">
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
