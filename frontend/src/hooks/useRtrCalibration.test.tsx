import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RtrCalibrationPreviewResponse, RtrCalibrationStateResponse, RtrCalibrationWindow } from '../types';
import { useRtrCalibration } from './useRtrCalibration';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown): Response {
    return {
        ok: true,
        json: async () => payload,
    } as Response;
}

const WINDOW_FIXTURE: RtrCalibrationWindow = {
    label: '4월 상순 고생산',
    startDate: '2026-04-01',
    endDate: '2026-04-05',
    enabled: true,
    houseId: 'house-a',
    approvalStatus: 'grower-approved',
    approvalSource: '농가 검토',
    approvalReason: '생산량과 균형이 안정적이었던 기간',
    evidenceNotes: '수확과 환경 지표 동시 확인',
    notes: '시범 저장',
};

function buildStateResponse(): RtrCalibrationStateResponse {
    return {
        status: 'ready',
        crop: 'Cucumber',
        greenhouse_id: 'house-a',
        current_profile: {
            crop: 'Cucumber',
            strategyLabel: 'Cucumber RTR',
            sourceNote: 'current profile',
            lightToRadiantDivisor: 218,
            baseTempC: 18.132,
            slopeCPerMjM2: 0.3099,
            toleranceC: 1,
            calibration: {
                mode: 'baseline',
                sampleDays: 14,
                fitStartDate: null,
                fitEndDate: null,
                minCoverageHours: 12,
                rSquared: null,
                meanAbsoluteErrorC: null,
                selectionSource: 'heuristic-fallback',
                windowCount: 0,
            },
            optimizer: {
                enabled: true,
                default_mode: 'balanced',
                max_delta_temp_C: 1.2,
                max_rtr_ratio_delta: 0.03,
                temp_slew_rate_C_per_step: 0.12,
                weights: {
                    temp: 1,
                    node: 150,
                    carbon: 120,
                    sink: 80,
                    resp: 20,
                    risk: 120,
                    energy: 25,
                    labor: 20,
                },
            },
        },
        windows: [WINDOW_FIXTURE],
        environment_summary: {
            has_environment_history: true,
            start_date: '2026-04-01',
            end_date: '2026-04-08',
            total_rows: 96,
            total_days: 8,
        },
        available_selection_modes: ['windows-only', 'auto', 'heuristic-only'],
        selection_mode: 'windows-only',
    };
}

function buildPreviewResponse(saved = false): RtrCalibrationPreviewResponse {
    return {
        status: 'ready',
        crop: 'Cucumber',
        greenhouse_id: 'house-a',
        selection_mode: 'windows-only',
        windows: [WINDOW_FIXTURE],
        preview_profile: {
            crop: 'Cucumber',
            strategyLabel: 'Cucumber RTR',
            sourceNote: 'preview profile',
            lightToRadiantDivisor: 218,
            baseTempC: 18.45,
            slopeCPerMjM2: 0.2842,
            toleranceC: 1,
            calibration: {
                mode: 'fitted',
                sampleDays: 5,
                fitStartDate: '2026-04-01',
                fitEndDate: '2026-04-05',
                minCoverageHours: 12,
                rSquared: 0.82,
                meanAbsoluteErrorC: 0.41,
                selectionSource: 'curated-windows',
                windowCount: 1,
            },
            optimizer: {
                enabled: true,
                default_mode: 'balanced',
                max_delta_temp_C: 1.2,
                max_rtr_ratio_delta: 0.03,
                temp_slew_rate_C_per_step: 0.12,
                weights: {
                    temp: 1,
                    node: 150,
                    carbon: 120,
                    sink: 80,
                    resp: 20,
                    risk: 120,
                    energy: 25,
                    labor: 20,
                },
            },
        },
        environment_summary: {
            has_environment_history: true,
            start_date: '2026-04-01',
            end_date: '2026-04-08',
            total_rows: 96,
            total_days: 8,
        },
        selection_summary: {
            filtered_days: 5,
            pre_filter_days: 8,
            selection_source: 'curated-windows',
            window_count: 1,
        },
        saved,
        current_profile: saved ? buildStateResponse().current_profile : undefined,
        config_paths: saved
            ? {
                windows: 'configs/rtr_good_windows.yaml',
                profiles: 'configs/rtr_profiles.json',
            }
            : undefined,
    };
}

describe('useRtrCalibration', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loads calibration state with crop and greenhouse scope', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(buildStateResponse()));

        const { result } = renderHook(() =>
            useRtrCalibration({ crop: 'Cucumber', greenhouseId: 'house-a' }),
        );

        await waitFor(() => {
            expect(result.current.loadingState).toBe(false);
            expect(result.current.stateResponse?.greenhouse_id).toBe('house-a');
        });

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/rtr/calibration-state?crop=Cucumber&greenhouse_id=house-a'),
        );
    });

    it('previews and saves calibration windows, then refreshes state', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(buildStateResponse()))
            .mockResolvedValueOnce(jsonResponse(buildPreviewResponse()))
            .mockResolvedValueOnce(jsonResponse(buildPreviewResponse(true)))
            .mockResolvedValueOnce(
                jsonResponse({
                    ...buildStateResponse(),
                    current_profile: buildPreviewResponse(true).preview_profile,
                }),
            );

        const { result } = renderHook(() =>
            useRtrCalibration({ crop: 'Cucumber', greenhouseId: 'house-a' }),
        );

        await waitFor(() => {
            expect(result.current.loadingState).toBe(false);
        });

        await act(async () => {
            await result.current.previewCalibration({
                windows: [WINDOW_FIXTURE],
                selectionMode: 'windows-only',
            });
        });

        expect(result.current.previewResponse?.preview_profile.calibration.mode).toBe('fitted');
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('/rtr/calibration-preview'),
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crop: 'Cucumber',
                    greenhouse_id: 'house-a',
                    selection_mode: 'windows-only',
                    windows: [WINDOW_FIXTURE],
                }),
            }),
        );

        await act(async () => {
            await result.current.saveCalibration({
                windows: [WINDOW_FIXTURE],
                selectionMode: 'windows-only',
            });
        });

        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('/rtr/calibration-save'),
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crop: 'Cucumber',
                    greenhouse_id: 'house-a',
                    selection_mode: 'windows-only',
                    windows: [WINDOW_FIXTURE],
                }),
            }),
        );
        expect(result.current.previewResponse?.saved).toBe(true);
        expect(result.current.stateResponse?.current_profile.calibration.mode).toBe('fitted');
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});
