import type { CropType, RtrProfile, SensorData, WeatherForecastDay } from '../types';

const RTR_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

// Research basis:
// - WUR frames RTR as the relation between daily average temperature and daily light integral.
// - TomatoesNZ publishes an example strategy line: T24 = 18.3 + 1.5 C per 1000 J/cm2/day.
// Converted here: 1000 J/cm2/day = 10 MJ/m2/day, so slope = 0.15 C per MJ/m2/day.
export const DEFAULT_RTR_PROFILES: Record<CropType, RtrProfile> = {
    Tomato: {
        crop: 'Tomato',
        strategyLabel: 'Tomato RTR baseline',
        sourceNote:
            'Baseline steering line from the WUR RTR framing and the TomatoesNZ example graph. Recalibrate with house-specific good-production days.',
        baseTempC: 18.3,
        slopeCPerMjM2: 0.15,
        toleranceC: 1.0,
        lightToRadiantDivisor: 4.57,
        calibration: {
            mode: 'baseline',
            sampleDays: 0,
            fitStartDate: null,
            fitEndDate: null,
            minCoverageHours: 20,
            rSquared: null,
            meanAbsoluteErrorC: null,
            selectionSource: 'heuristic-fallback',
            windowCount: 0,
        },
    },
    Cucumber: {
        crop: 'Cucumber',
        strategyLabel: 'Cucumber RTR baseline',
        sourceNote:
            'Baseline steering line with cucumber interpretation anchored to 24-hour mean-temperature guidance around 21 C. Recalibrate per house.',
        baseTempC: 18.3,
        slopeCPerMjM2: 0.15,
        toleranceC: 1.0,
        lightToRadiantDivisor: 4.57,
        calibration: {
            mode: 'baseline',
            sampleDays: 0,
            fitStartDate: null,
            fitEndDate: null,
            minCoverageHours: 20,
            rSquared: null,
            meanAbsoluteErrorC: null,
            selectionSource: 'heuristic-fallback',
            windowCount: 0,
        },
    },
};

export function getRtrProfile(crop: CropType, profile?: RtrProfile | null): RtrProfile {
    const baselineProfile = DEFAULT_RTR_PROFILES[crop];
    if (!profile) {
        return baselineProfile;
    }

    return {
        ...baselineProfile,
        ...profile,
        crop,
        calibration: {
            ...baselineProfile.calibration,
            ...profile.calibration,
        },
    };
}

export type RTRBalanceState = 'balanced' | 'warm-for-light' | 'cool-for-light';

export interface RTRLiveSnapshot {
    windowHours: number;
    coveragePct: number;
    averageTempC: number;
    dliMolM2D: number;
    radiationSumMjM2D: number;
    targetTempC: number;
    deltaTempC: number;
    balanceState: RTRBalanceState;
}

export interface RTRForecastTarget {
    date: string;
    weatherLabel: string;
    radiationSumMjM2D: number;
    targetTempC: number;
}

function deriveSampleIntervalMs(points: SensorData[]): number {
    if (points.length < 2) return DEFAULT_INTERVAL_MS;

    const deltas = points
        .slice(1)
        .map((point, index) => point.timestamp - points[index].timestamp)
        .filter((delta) => Number.isFinite(delta) && delta > 0);

    if (deltas.length === 0) return DEFAULT_INTERVAL_MS;

    const midpoint = Math.floor(deltas.length / 2);
    const sorted = [...deltas].sort((a, b) => a - b);
    return sorted[midpoint] ?? DEFAULT_INTERVAL_MS;
}

function getWindowPoints(history: SensorData[], currentData: SensorData): SensorData[] {
    const source = history.length > 0 ? history : [currentData];
    const latestTs = source[source.length - 1]?.timestamp ?? currentData.timestamp;
    const windowStart = latestTs - RTR_WINDOW_MS;
    return source.filter((point) => point.timestamp >= windowStart);
}

function classifyRTRBalance(deltaTempC: number, toleranceC: number): RTRBalanceState {
    if (deltaTempC > toleranceC) return 'warm-for-light';
    if (deltaTempC < -toleranceC) return 'cool-for-light';
    return 'balanced';
}

export function buildRTRLiveSnapshot(
    currentData: SensorData,
    history: SensorData[],
    crop: CropType,
    profile?: RtrProfile | null,
): RTRLiveSnapshot {
    const effectiveProfile = getRtrProfile(crop, profile);
    const points = getWindowPoints(history, currentData);
    const sampleIntervalMs = deriveSampleIntervalMs(points);

    let totalMs = 0;
    let weightedTempMs = 0;
    let accumulatedPpfdUmol = 0;
    let accumulatedRadiantJ = 0;

    points.forEach((point, index) => {
        const nextPoint = points[index + 1];
        const durationMs = nextPoint
            ? Math.max(0, nextPoint.timestamp - point.timestamp)
            : sampleIntervalMs;
        const durationSeconds = durationMs / 1000;
        const radiantFluxWm2 = point.light / effectiveProfile.lightToRadiantDivisor;

        totalMs += durationMs;
        weightedTempMs += point.temperature * durationMs;
        accumulatedPpfdUmol += point.light * durationSeconds;
        accumulatedRadiantJ += radiantFluxWm2 * durationSeconds;
    });

    const windowHours = totalMs / (1000 * 60 * 60);
    const averageTempC = totalMs > 0 ? weightedTempMs / totalMs : currentData.temperature;
    const dliMolM2D = accumulatedPpfdUmol / 1_000_000;
    const radiationSumMjM2D = accumulatedRadiantJ / 1_000_000;
    const targetTempC =
        effectiveProfile.baseTempC + effectiveProfile.slopeCPerMjM2 * radiationSumMjM2D;
    const deltaTempC = averageTempC - targetTempC;

    return {
        windowHours,
        coveragePct: Math.min(100, (windowHours / 24) * 100),
        averageTempC,
        dliMolM2D,
        radiationSumMjM2D,
        targetTempC,
        deltaTempC,
        balanceState: classifyRTRBalance(deltaTempC, effectiveProfile.toleranceC),
    };
}

export function buildRTRForecastTargets(
    dailyForecast: WeatherForecastDay[] = [],
    crop: CropType,
    profile?: RtrProfile | null,
): RTRForecastTarget[] {
    const effectiveProfile = getRtrProfile(crop, profile);
    return dailyForecast.map((day) => ({
        date: day.date,
        weatherLabel: day.weather_label,
        radiationSumMjM2D: day.shortwave_radiation_sum_mj_m2,
        targetTempC:
            effectiveProfile.baseTempC
            + effectiveProfile.slopeCPerMjM2 * day.shortwave_radiation_sum_mj_m2,
    }));
}
