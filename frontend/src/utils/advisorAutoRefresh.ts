export const AUTO_ANALYSIS_INTERVAL_MS = 60 * 1000;
export const AUTO_ANALYSIS_RETRY_BACKOFF_MS = 30 * 1000;

export type AdvisorAutoRefreshState = {
    telemetryReceivedAt: number;
    marketFetchedAt: string | null;
    weatherFetchedAt: string | null;
    profilesUpdatedAt: string | null;
    forecastSignature: string | null;
};

export function createEmptyAdvisorAutoRefreshState(): AdvisorAutoRefreshState {
    return {
        telemetryReceivedAt: 0,
        marketFetchedAt: null,
        weatherFetchedAt: null,
        profilesUpdatedAt: null,
        forecastSignature: null,
    };
}

export function buildAdvisorForecastSignature(forecast: unknown): string | null {
    if (forecast == null) {
        return null;
    }

    try {
        return JSON.stringify(forecast);
    } catch {
        return String(forecast);
    }
}

export function shouldRefreshAdvisorSummary(
    previous: AdvisorAutoRefreshState,
    next: AdvisorAutoRefreshState,
    intervalMs: number = AUTO_ANALYSIS_INTERVAL_MS,
): boolean {
    if (next.telemetryReceivedAt <= 0) {
        return false;
    }

    if (previous.telemetryReceivedAt === 0) {
        return true;
    }

    if (next.telemetryReceivedAt - previous.telemetryReceivedAt >= intervalMs) {
        return true;
    }

    if (next.marketFetchedAt !== null && next.marketFetchedAt !== previous.marketFetchedAt) {
        return true;
    }

    if (next.weatherFetchedAt !== null && next.weatherFetchedAt !== previous.weatherFetchedAt) {
        return true;
    }

    if (next.profilesUpdatedAt !== null && next.profilesUpdatedAt !== previous.profilesUpdatedAt) {
        return true;
    }

    if (next.forecastSignature !== null && next.forecastSignature !== previous.forecastSignature) {
        return true;
    }

    return false;
}
