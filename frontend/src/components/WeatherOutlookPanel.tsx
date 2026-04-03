import { CloudRain, CloudSun, MapPinned, Thermometer, Wind } from 'lucide-react';
import type { WeatherOutlook } from '../types';

interface WeatherOutlookPanelProps {
    weather: WeatherOutlook | null;
    loading: boolean;
    error: string | null;
}

const formatForecastLabel = (date: string): string =>
    new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });

const WeatherOutlookPanel = ({ weather, loading, error }: WeatherOutlookPanelProps) => (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
            <div>
                <div className="flex items-center gap-2 text-slate-800">
                    <CloudSun className="h-5 w-5 text-sky-500" />
                    <h3 className="font-semibold">Daegu Live Weather</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">Current conditions + 3-day outlook for Daegu</p>
            </div>
            <div className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                Open-Meteo
            </div>
        </div>

        {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading live Daegu weather...</div>
        ) : error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Weather panel is unavailable: {error}
            </div>
        ) : weather ? (
            <div className="space-y-4">
                <div className="rounded-lg bg-gradient-to-br from-sky-50 to-cyan-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <MapPinned className="h-3.5 w-3.5 text-sky-600" />
                                <span>{weather.location.name}, {weather.location.country}</span>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2 text-slate-900">
                                <span className="text-3xl font-bold">{weather.current.temperature_c.toFixed(1)}°C</span>
                                <span className="text-sm text-slate-500">
                                    feels like {weather.current.apparent_temperature_c.toFixed(1)}°C
                                </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-700">{weather.current.weather_label}</p>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-3 py-2 text-right text-xs text-slate-500 shadow-sm">
                            <div>{new Date(weather.current.time).toLocaleString()}</div>
                            <div className="mt-1">{weather.location.timezone}</div>
                        </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{weather.summary}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Thermometer className="h-4 w-4 text-orange-500" />
                            <span>Humidity / Clouds</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                            RH {weather.current.relative_humidity_pct.toFixed(0)}% | Cloud {weather.current.cloud_cover_pct.toFixed(0)}%
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Wind className="h-4 w-4 text-teal-500" />
                            <span>Wind / Rain</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                            {weather.current.wind_speed_kmh.toFixed(1)} km/h | {weather.current.precipitation_mm.toFixed(1)} mm
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    {weather.daily.map((day) => (
                        <div key={day.date} className="rounded-lg border border-slate-100 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-800">{formatForecastLabel(day.date)}</div>
                                    <div className="mt-1 text-xs text-slate-500">{day.weather_label}</div>
                                </div>
                                <div className="text-right text-sm text-slate-700">
                                    <div className="font-semibold">{day.temperature_max_c.toFixed(1)}°C / {day.temperature_min_c.toFixed(1)}°C</div>
                                    <div className="mt-1 text-xs text-slate-500">{day.sunshine_duration_h.toFixed(1)} h sun</div>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                                <div className="rounded-md bg-slate-50 px-2 py-2">
                                    <div className="flex items-center gap-1">
                                        <CloudRain className="h-3.5 w-3.5 text-cyan-500" />
                                        <span>Rain risk</span>
                                    </div>
                                    <div className="mt-1 font-medium text-slate-700">{day.precipitation_probability_max_pct.toFixed(0)}%</div>
                                </div>
                                <div className="rounded-md bg-slate-50 px-2 py-2">
                                    <div>Shortwave</div>
                                    <div className="mt-1 font-medium text-slate-700">{day.shortwave_radiation_sum_mj_m2.toFixed(1)} MJ m⁻²</div>
                                </div>
                                <div className="rounded-md bg-slate-50 px-2 py-2">
                                    <div>Wind max</div>
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

export default WeatherOutlookPanel;
