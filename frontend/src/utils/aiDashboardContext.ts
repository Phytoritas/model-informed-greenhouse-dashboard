import type {
    AdvancedModelMetrics,
    CropType,
    ForecastData,
    RtrProfile,
    SensorData,
    WeatherOutlook,
} from '../types';
import { buildDashboardRecentSummary } from './recentSummary';
import {
    buildRTRForecastTargets,
    buildRTRLiveSnapshot,
    getRtrProfile,
} from './rtr';

interface BuildAiDashboardContextArgs {
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
    crop: CropType;
    history?: SensorData[];
    forecast?: ForecastData | null;
    weather?: WeatherOutlook | null;
    rtrProfile?: RtrProfile | null;
}

export function buildAiDashboardContext({
    currentData,
    metrics,
    crop,
    history = [],
    forecast = null,
    weather = null,
    rtrProfile = null,
}: BuildAiDashboardContextArgs) {
    const recentSummary = buildDashboardRecentSummary(currentData, history, 60);
    const effectiveProfile = getRtrProfile(crop, rtrProfile);

    return {
        data: currentData,
        metrics,
        forecast,
        recentSummary,
        weather: weather
            ? {
                location: weather.location,
                summary: weather.summary,
                current: weather.current,
                daily: weather.daily.slice(0, 3),
            }
            : null,
        rtr: {
            profile: {
                strategyLabel: effectiveProfile.strategyLabel,
                baseTempC: effectiveProfile.baseTempC,
                slopeCPerMjM2: effectiveProfile.slopeCPerMjM2,
                toleranceC: effectiveProfile.toleranceC,
                calibration: effectiveProfile.calibration,
            },
            live: buildRTRLiveSnapshot(currentData, history, crop, effectiveProfile),
            forecastTargets: buildRTRForecastTargets(weather?.daily ?? [], crop, effectiveProfile).slice(0, 3),
        },
    };
}
