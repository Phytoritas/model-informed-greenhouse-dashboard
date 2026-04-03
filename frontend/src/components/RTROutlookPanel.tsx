import { CalendarDays, Leaf, Sun, Target, Thermometer } from 'lucide-react';
import type { CropType, RtrProfile, SensorData, TemperatureSettings, WeatherOutlook } from '../types';
import {
    getRtrProfile,
    buildRTRForecastTargets,
    buildRTRLiveSnapshot,
} from '../utils/rtr';

interface RTROutlookPanelProps {
    crop: CropType;
    currentData: SensorData;
    history: SensorData[];
    temperatureSettings: TemperatureSettings;
    weather: WeatherOutlook | null;
    loading: boolean;
    error: string | null;
    profile: RtrProfile | null;
    profileLoading: boolean;
    profileError: string | null;
}

const formatForecastLabel = (date: string): string =>
    new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });

const BALANCE_COPY = {
    balanced: {
        badge: 'Near RTR line',
        tone: 'bg-emerald-100 text-emerald-700',
        description: 'Temperature and light are moving together in a balanced range.',
    },
    'warm-for-light': {
        badge: 'Warm for light',
        tone: 'bg-rose-100 text-rose-700',
        description: 'Temperature is running ahead of the available light, which can push the crop more generative.',
    },
    'cool-for-light': {
        badge: 'Cool for light',
        tone: 'bg-sky-100 text-sky-700',
        description: 'Light is strong relative to the current temperature, which can push the crop more vegetative.',
    },
} as const;

const RTROutlookPanel = ({
    crop,
    currentData,
    history,
    temperatureSettings,
    weather,
    loading,
    error,
    profile,
    profileLoading,
    profileError,
}: RTROutlookPanelProps) => {
    const effectiveProfile = getRtrProfile(crop, profile);
    const liveSnapshot = buildRTRLiveSnapshot(currentData, history, crop, effectiveProfile);
    const forecastTargets = buildRTRForecastTargets(
        weather?.daily ?? [],
        crop,
        effectiveProfile,
    );
    const balanceCopy = BALANCE_COPY[liveSnapshot.balanceState];
    const profileBadge = effectiveProfile.calibration.mode === 'fitted'
        ? `House-fit (${effectiveProfile.calibration.sampleDays} d)`
        : effectiveProfile.calibration.mode === 'insufficient-data'
            ? 'Baseline (needs more data)'
            : 'Baseline';
    const selectionLabel = effectiveProfile.calibration.selectionSource === 'curated-windows'
        ? `curated windows (${effectiveProfile.calibration.windowCount ?? 0})`
        : 'heuristic fallback';

    return (
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-slate-800">
                        <Target className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-semibold">RTR Monitor</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                        Rolling 24 h radiation-to-temperature balance for {crop}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                        {profileBadge}
                    </div>
                    {profileLoading ? (
                        <div className="text-[11px] text-slate-400">Loading RTR profile...</div>
                    ) : null}
                </div>
            </div>

            <div className="space-y-4">
                <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-lime-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <Leaf className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Rolling 24 h RTR</span>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2 text-slate-900">
                                <span className="text-3xl font-bold">{liveSnapshot.deltaTempC.toFixed(1)}&deg;C</span>
                                <span className="text-sm text-slate-500">vs profile line</span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-700">{balanceCopy.description}</p>
                            <p className="mt-2 text-xs leading-relaxed text-slate-500">{effectiveProfile.sourceNote}</p>
                        </div>
                        <div className={`rounded-2xl px-3 py-2 text-right text-xs font-medium shadow-sm ${balanceCopy.tone}`}>
                            {balanceCopy.badge}
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                        Window coverage {liveSnapshot.windowHours.toFixed(1)} h / 24 h
                        <span className="ml-2 font-medium text-slate-700">{liveSnapshot.coveragePct.toFixed(0)}%</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Sun className="h-4 w-4 text-amber-500" />
                            <span>Radiation sum</span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-800">
                            {liveSnapshot.radiationSumMjM2D.toFixed(1)} MJ m⁻²
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            DLI {liveSnapshot.dliMolM2D.toFixed(1)} mol m⁻² d⁻¹
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Thermometer className="h-4 w-4 text-orange-500" />
                            <span>24 h mean temp</span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-800">
                            {liveSnapshot.averageTempC.toFixed(1)}&deg;C
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            Example target {liveSnapshot.targetTempC.toFixed(1)}&deg;C
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <CalendarDays className="h-4 w-4 text-slate-500" />
                        <span>3-day RTR steering plan</span>
                    </div>
                    <div className="mt-3 space-y-2">
                        {loading ? (
                            <div className="rounded-md bg-white px-3 py-3 text-sm text-slate-500">
                                Loading Daegu radiation forecast...
                            </div>
                        ) : forecastTargets.length > 0 ? (
                            forecastTargets.map((day) => (
                                <div key={day.date} className="rounded-md bg-white px-3 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-800">{formatForecastLabel(day.date)}</div>
                                            <div className="mt-1 text-xs text-slate-500">{day.weatherLabel}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-slate-800">
                                                {day.targetTempC.toFixed(1)}&deg;C
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                {day.radiationSumMjM2D.toFixed(1)} MJ m⁻² d⁻¹
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-md bg-white px-3 py-3 text-sm text-slate-500">
                                Forecast-linked RTR targets are waiting for radiation data.
                            </div>
                        )}
                    </div>
                    {error ? (
                        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                            Weather-linked RTR forecast is unavailable: {error}
                        </div>
                    ) : null}
                </div>

                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs leading-relaxed text-slate-500">
                    <div className="font-medium text-slate-700">{effectiveProfile.strategyLabel}</div>
                    <div className="mt-1">
                        Reference line: T24 = {effectiveProfile.baseTempC.toFixed(1)} + {effectiveProfile.slopeCPerMjM2.toFixed(2)} x radiation sum (MJ m⁻² d⁻¹).
                    </div>
                    <div className="mt-1">
                        Profile mode: {effectiveProfile.calibration.mode}, sample days: {effectiveProfile.calibration.sampleDays}.
                    </div>
                    <div className="mt-1">
                        Selection path: {selectionLabel}.
                    </div>
                    {effectiveProfile.calibration.rSquared !== null ? (
                        <div className="mt-1">
                            Fit quality: R² {effectiveProfile.calibration.rSquared.toFixed(2)}, MAE {effectiveProfile.calibration.meanAbsoluteErrorC?.toFixed(2)}°C.
                        </div>
                    ) : null}
                    <div className="mt-1">
                        Current control window: {temperatureSettings.heating}&deg;C to {temperatureSettings.cooling}&deg;C.
                    </div>
                    {profileError ? (
                        <div className="mt-1 text-amber-700">
                            RTR profile endpoint unavailable, using bundled baseline: {profileError}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default RTROutlookPanel;
