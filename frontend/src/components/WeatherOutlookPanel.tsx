import { CloudRain, CloudSun, MapPinned, Thermometer, Wind } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDate, formatLocaleDateTime } from '../i18n/locale';
import { getCountryLabel, getWeatherLabel } from '../utils/displayCopy';
import type { WeatherOutlook } from '../types';

interface WeatherOutlookPanelProps {
    weather: WeatherOutlook | null;
    loading: boolean;
    error: string | null;
}

const WeatherOutlookPanel = ({ weather, loading, error }: WeatherOutlookPanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            title: '대구 실시간 날씨',
            subtitle: '현재 상태와 3일 전망',
            loading: '대구 실시간 날씨를 불러오는 중...',
            unavailable: '날씨 패널을 불러올 수 없습니다',
            feelsLike: '체감',
            humidityClouds: '습도 / 운량',
            windRain: '바람 / 강수',
            humidityShort: '습도',
            cloudShort: '운량',
            rainRisk: '강수 확률',
            shortwave: '단파복사',
            windMax: '최대 풍속',
            sunHours: '시간 일조',
        }
        : {
            title: 'Daegu Live Weather',
            subtitle: 'Current conditions + 3-day outlook for Daegu',
            loading: 'Loading live Daegu weather...',
            unavailable: 'Weather panel is unavailable',
            feelsLike: 'feels like',
            humidityClouds: 'Humidity / Clouds',
            windRain: 'Wind / Rain',
            humidityShort: 'RH',
            cloudShort: 'Cloud',
            rainRisk: 'Rain risk',
            shortwave: 'Shortwave',
            windMax: 'Wind max',
            sunHours: 'h sun',
        };
    const formatForecastLabel = (date: string): string =>
        formatLocaleDate(locale, `${date}T00:00:00`, { month: 'short', day: 'numeric', weekday: 'short' });
    const today = weather?.daily[0];
    const currentWeatherLabel = weather ? getWeatherLabel(weather.current.weather_code, weather.current.weather_label, locale) : '';
    const summary = weather
        ? locale === 'ko'
            ? `현재 대구는 ${currentWeatherLabel} 상태이며 기온은 ${weather.current.temperature_c.toFixed(1)}°C, 풍속은 ${weather.current.wind_speed_kmh.toFixed(1)} km/h입니다. 오늘은 최고 ${(today?.temperature_max_c ?? weather.current.temperature_c).toFixed(1)}°C / 최저 ${(today?.temperature_min_c ?? weather.current.temperature_c).toFixed(1)}°C, 강수 확률 최대 ${(today?.precipitation_probability_max_pct ?? 0).toFixed(0)}%가 예상됩니다.`
            : `Daegu is currently ${currentWeatherLabel.toLowerCase()} at ${weather.current.temperature_c.toFixed(1)}°C with ${weather.current.wind_speed_kmh.toFixed(1)} km/h wind. Today reaches ${(today?.temperature_max_c ?? weather.current.temperature_c).toFixed(1)}°C / ${(today?.temperature_min_c ?? weather.current.temperature_c).toFixed(1)}°C with up to ${(today?.precipitation_probability_max_pct ?? 0).toFixed(0)}% rain risk.`
        : '';

    return (
    <div className="flex h-full flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
            <div>
                <div className="flex items-center gap-2 text-slate-800">
                    <CloudSun className="h-5 w-5 text-sky-500" />
                    <h3 className="font-semibold">{copy.title}</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">{copy.subtitle}</p>
            </div>
            <div className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                Open-Meteo
            </div>
        </div>

        {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{copy.loading}</div>
        ) : error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {copy.unavailable}: {error}
            </div>
        ) : weather ? (
            <div className="flex h-full flex-col space-y-4">
                <div className="rounded-lg bg-gradient-to-br from-sky-50 to-cyan-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <MapPinned className="h-3.5 w-3.5 text-sky-600" />
                                <span>{weather.location.name}, {getCountryLabel(weather.location.country, locale)}</span>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2 text-slate-900">
                                <span className="text-3xl font-bold">{weather.current.temperature_c.toFixed(1)}°C</span>
                                <span className="text-sm text-slate-500">
                                    {copy.feelsLike} {weather.current.apparent_temperature_c.toFixed(1)}°C
                                </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-700">{currentWeatherLabel}</p>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-3 py-2 text-right text-xs text-slate-500 shadow-sm">
                            <div>{formatLocaleDateTime(locale, weather.current.time)}</div>
                            <div className="mt-1">{weather.location.timezone}</div>
                        </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{summary}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Thermometer className="h-4 w-4 text-orange-500" />
                            <span>{copy.humidityClouds}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                            {copy.humidityShort} {weather.current.relative_humidity_pct.toFixed(0)}% | {copy.cloudShort} {weather.current.cloud_cover_pct.toFixed(0)}%
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Wind className="h-4 w-4 text-teal-500" />
                            <span>{copy.windRain}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                            {weather.current.wind_speed_kmh.toFixed(1)} km/h | {weather.current.precipitation_mm.toFixed(1)} mm
                        </div>
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                    {weather.daily.map((day) => (
                        <div key={day.date} className="h-full rounded-lg border border-slate-100 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-800">{formatForecastLabel(day.date)}</div>
                                    <div className="mt-1 text-xs text-slate-500">{getWeatherLabel(day.weather_code, day.weather_label, locale)}</div>
                                </div>
                                <div className="text-right text-sm text-slate-700">
                                    <div className="font-semibold">{day.temperature_max_c.toFixed(1)}°C / {day.temperature_min_c.toFixed(1)}°C</div>
                                    <div className="mt-1 text-xs text-slate-500">{day.sunshine_duration_h.toFixed(1)} {copy.sunHours}</div>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                                <div className="rounded-md bg-slate-50 px-2 py-2">
                                    <div className="flex items-center gap-1">
                                        <CloudRain className="h-3.5 w-3.5 text-cyan-500" />
                                        <span>{copy.rainRisk}</span>
                                    </div>
                                    <div className="mt-1 font-medium text-slate-700">{day.precipitation_probability_max_pct.toFixed(0)}%</div>
                                </div>
                                <div className="rounded-md bg-slate-50 px-2 py-2">
                                    <div>{copy.shortwave}</div>
                                    <div className="mt-1 font-medium text-slate-700">{day.shortwave_radiation_sum_mj_m2.toFixed(1)} MJ m⁻²</div>
                                </div>
                                <div className="rounded-md bg-slate-50 px-2 py-2">
                                    <div>{copy.windMax}</div>
                                    <div className="mt-1 font-medium text-slate-700">{day.wind_speed_max_kmh.toFixed(1)} km/h</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ) : null}
    </div>
    );
};

export default WeatherOutlookPanel;
