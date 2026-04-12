import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../config';
import type { CropType, OverviewSignalsPayload } from '../types';

const OVERVIEW_SIGNAL_REFRESH_MS = 10 * 1000;
const OVERVIEW_SIGNAL_REQUEST_TIMEOUT_MS = 30 * 1000;
const OVERVIEW_SIGNAL_ABORT_ERROR = '실제 신호 추세 응답이 지연되고 있습니다.';

async function readJson<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
        throw new Error((data as { detail?: string })?.detail ?? `HTTP ${response.status}`);
    }
    return data as T;
}

export function useOverviewSignalTrends(crop: CropType) {
    const [signals, setSignals] = useState<OverviewSignalsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
    const inFlightRef = useRef(false);
    const queuedRefreshRef = useRef(false);
    const refreshSessionRef = useRef(0);

    const refresh = useCallback(async (showLoading = false) => {
        const refreshSession = refreshSessionRef.current;
        if (inFlightRef.current) {
            queuedRefreshRef.current = true;
            return;
        }
        inFlightRef.current = true;
        if (showLoading) {
            setLoading(true);
        }
        const controller = new AbortController();
        const timeoutHandle = window.setTimeout(() => controller.abort(), OVERVIEW_SIGNAL_REQUEST_TIMEOUT_MS);
        try {
            const cropKey = crop.toLowerCase();
            const data = await fetch(
                `${API_URL}/overview/signals?crop=${cropKey}&window_hours=72`,
                { signal: controller.signal },
            ).then((response) => readJson<OverviewSignalsPayload>(response));
            if (refreshSession !== refreshSessionRef.current) {
                return;
            }
            setSignals((previous) => {
                const nextIrradiancePoints = data.irradiance?.points ?? [];
                const previousIrradiancePoints = previous?.irradiance?.points ?? [];
                const hasFreshIrradianceSeries = nextIrradiancePoints.length >= 2;
                const hasPreviousIrradianceSeries = previousIrradiancePoints.length >= 2;

                if (hasFreshIrradianceSeries || !hasPreviousIrradianceSeries || !previous) {
                    return data;
                }

                return {
                    ...data,
                    irradiance: {
                        ...previous.irradiance,
                        source: data.irradiance?.source ?? previous.irradiance.source,
                        window_hours: data.irradiance?.window_hours ?? previous.irradiance.window_hours,
                    },
                };
            });
            setRefreshedAt(Date.now());
            setError(null);
        } catch (err) {
            if (refreshSession !== refreshSessionRef.current) {
                return;
            }
            const errorName = typeof err === 'object' && err !== null && 'name' in err
                ? String((err as { name?: unknown }).name ?? '')
                : '';
            const errorMessage = typeof err === 'object' && err !== null && 'message' in err
                ? String((err as { message?: unknown }).message ?? '')
                : null;
            const isAbortError = errorName === 'AbortError';
            setError(
                isAbortError
                    ? OVERVIEW_SIGNAL_ABORT_ERROR
                    : (errorMessage && errorMessage.length > 0 ? errorMessage : '실제 신호 추세를 불러오지 못했습니다.'),
            );
        } finally {
            window.clearTimeout(timeoutHandle);
            if (refreshSession === refreshSessionRef.current) {
                inFlightRef.current = false;
                setLoading(false);
                if (queuedRefreshRef.current) {
                    queuedRefreshRef.current = false;
                    void refresh(false).catch(() => {
                        // Errors are surfaced through hook state.
                    });
                }
            }
        }
    }, [crop]);

    useEffect(() => {
        refreshSessionRef.current += 1;
        setError(null);
        setRefreshedAt(null);
        queuedRefreshRef.current = false;
        inFlightRef.current = false;
        void refresh(true).catch(() => {
            // Errors are surfaced through hook state.
        });
        const interval = window.setInterval(() => {
            void refresh().catch(() => {
                // Errors are surfaced through hook state.
            });
        }, OVERVIEW_SIGNAL_REFRESH_MS);
        return () => {
            refreshSessionRef.current += 1;
            queuedRefreshRef.current = false;
            inFlightRef.current = false;
            window.clearInterval(interval);
        };
    }, [refresh]);

    return { signals, loading, error, refresh, refreshedAt };
}
