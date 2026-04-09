import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../config';
import type {
    CropType,
    RtrCalibrationPreviewResponse,
    RtrCalibrationSelectionMode,
    RtrCalibrationStateResponse,
    RtrCalibrationWindow,
} from '../types';

interface UseRtrCalibrationOptions {
    crop: CropType;
    greenhouseId?: string;
}

async function readJson<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
        throw new Error((data as { detail?: string })?.detail ?? `HTTP ${response.status}`);
    }
    return data as T;
}

export const useRtrCalibration = ({
    crop,
    greenhouseId,
}: UseRtrCalibrationOptions) => {
    const cropKey = crop.toLowerCase();
    const [stateResponse, setStateResponse] = useState<RtrCalibrationStateResponse | null>(null);
    const [previewResponse, setPreviewResponse] = useState<RtrCalibrationPreviewResponse | null>(null);
    const [loadingState, setLoadingState] = useState(true);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshState = useCallback(async () => {
        setLoadingState(true);
        try {
            const params = new URLSearchParams({ crop: cropKey });
            if (greenhouseId) {
                params.set('greenhouse_id', greenhouseId);
            }
            const data = await fetch(`${API_URL}/rtr/calibration-state?${params.toString()}`).then((response) =>
                readJson<RtrCalibrationStateResponse>(response),
            );
            setStateResponse(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load RTR calibration state.');
        } finally {
            setLoadingState(false);
        }
    }, [cropKey, greenhouseId]);

    useEffect(() => {
        setStateResponse(null);
        setPreviewResponse(null);
        setError(null);
        void refreshState();
    }, [refreshState]);

    const previewCalibration = useCallback(
        async ({
            windows,
            selectionMode,
        }: {
            windows: RtrCalibrationWindow[];
            selectionMode: RtrCalibrationSelectionMode;
        }) => {
            setLoadingPreview(true);
            try {
                const data = await fetch(`${API_URL}/rtr/calibration-preview`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        crop: cropKey,
                        greenhouse_id: greenhouseId,
                        selection_mode: selectionMode,
                        windows,
                    }),
                }).then((response) => readJson<RtrCalibrationPreviewResponse>(response));
                setPreviewResponse(data);
                setError(null);
                return data;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to preview RTR calibration.');
                throw err;
            } finally {
                setLoadingPreview(false);
            }
        },
        [cropKey, greenhouseId],
    );

    const saveCalibration = useCallback(
        async ({
            windows,
            selectionMode,
        }: {
            windows: RtrCalibrationWindow[];
            selectionMode: RtrCalibrationSelectionMode;
        }) => {
            setSaving(true);
            try {
                const data = await fetch(`${API_URL}/rtr/calibration-save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        crop: cropKey,
                        greenhouse_id: greenhouseId,
                        selection_mode: selectionMode,
                        windows,
                    }),
                }).then((response) => readJson<RtrCalibrationPreviewResponse>(response));
                setPreviewResponse(data);
                setError(null);
                await refreshState();
                return data;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save RTR calibration.');
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [cropKey, greenhouseId, refreshState],
    );

    return {
        stateResponse,
        previewResponse,
        loadingState,
        loadingPreview,
        saving,
        error,
        refreshState,
        previewCalibration,
        saveCalibration,
    };
};
