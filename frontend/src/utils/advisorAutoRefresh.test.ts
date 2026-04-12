import { describe, expect, it } from 'vitest';

import {
    AUTO_ANALYSIS_INTERVAL_MS,
    buildAdvisorForecastSignature,
    createEmptyAdvisorAutoRefreshState,
    shouldRefreshAdvisorSummary,
    type AdvisorAutoRefreshState,
} from './advisorAutoRefresh';

function buildState(
    overrides: Partial<AdvisorAutoRefreshState> = {},
): AdvisorAutoRefreshState {
    return {
        ...createEmptyAdvisorAutoRefreshState(),
        ...overrides,
    };
}

describe('shouldRefreshAdvisorSummary', () => {
    it('refreshes when telemetry is received for the first time', () => {
        const previous = createEmptyAdvisorAutoRefreshState();
        const next = buildState({ telemetryReceivedAt: 1_000 });

        expect(shouldRefreshAdvisorSummary(previous, next)).toBe(true);
    });

    it('does not refresh when nothing meaningful changed inside the interval', () => {
        const previous = buildState({
            telemetryReceivedAt: 10_000,
            marketFetchedAt: '2026-04-12T09:00:00+09:00',
            weatherFetchedAt: '2026-04-12T09:00:00+09:00',
            profilesUpdatedAt: '2026-04-12T08:50:00+09:00',
        });
        const next = buildState({
            telemetryReceivedAt: 10_000 + AUTO_ANALYSIS_INTERVAL_MS - 1,
            marketFetchedAt: previous.marketFetchedAt,
            weatherFetchedAt: previous.weatherFetchedAt,
            profilesUpdatedAt: previous.profilesUpdatedAt,
        });

        expect(shouldRefreshAdvisorSummary(previous, next)).toBe(false);
    });

    it('refreshes when telemetry receive time crosses the refresh interval', () => {
        const previous = buildState({ telemetryReceivedAt: 10_000 });
        const next = buildState({
            telemetryReceivedAt: 10_000 + AUTO_ANALYSIS_INTERVAL_MS,
        });

        expect(shouldRefreshAdvisorSummary(previous, next)).toBe(true);
    });

    it('refreshes when market prices were updated', () => {
        const previous = buildState({
            telemetryReceivedAt: 10_000,
            marketFetchedAt: '2026-04-12T09:00:00+09:00',
        });
        const next = buildState({
            telemetryReceivedAt: 10_100,
            marketFetchedAt: '2026-04-12T09:15:00+09:00',
        });

        expect(shouldRefreshAdvisorSummary(previous, next)).toBe(true);
    });

    it('refreshes when weather outlook was updated', () => {
        const previous = buildState({
            telemetryReceivedAt: 10_000,
            weatherFetchedAt: '2026-04-12T09:00:00+09:00',
        });
        const next = buildState({
            telemetryReceivedAt: 10_100,
            weatherFetchedAt: '2026-04-12T09:15:00+09:00',
        });

        expect(shouldRefreshAdvisorSummary(previous, next)).toBe(true);
    });

    it('refreshes when RTR profile metadata changed', () => {
        const previous = buildState({
            telemetryReceivedAt: 10_000,
            profilesUpdatedAt: '2026-04-12T09:00:00+09:00',
        });
        const next = buildState({
            telemetryReceivedAt: 10_100,
            profilesUpdatedAt: '2026-04-12T09:15:00+09:00',
        });

        expect(shouldRefreshAdvisorSummary(previous, next)).toBe(true);
    });

    it('refreshes when forecast content changed', () => {
        const previous = buildState({
            telemetryReceivedAt: 10_000,
            forecastSignature: buildAdvisorForecastSignature({
                daily: [{ date: '2026-04-12', harvest_kg: 1.2 }],
            }),
        });
        const next = buildState({
            telemetryReceivedAt: 10_100,
            forecastSignature: buildAdvisorForecastSignature({
                daily: [{ date: '2026-04-12', harvest_kg: 1.6 }],
            }),
        });

        expect(shouldRefreshAdvisorSummary(previous, next)).toBe(true);
    });

    it('does not refresh before telemetry has been received', () => {
        const previous = createEmptyAdvisorAutoRefreshState();
        const next = buildState({
            marketFetchedAt: '2026-04-12T09:15:00+09:00',
            weatherFetchedAt: '2026-04-12T09:15:00+09:00',
            profilesUpdatedAt: '2026-04-12T09:15:00+09:00',
            forecastSignature: buildAdvisorForecastSignature({ daily: [] }),
        });

        expect(shouldRefreshAdvisorSummary(previous, next)).toBe(false);
    });
});
