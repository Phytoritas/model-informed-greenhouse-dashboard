import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../config';
import type { CropType, OverviewSignalsPayload } from '../types';

const OVERVIEW_SIGNAL_REFRESH_MS = 60 * 1000;
const OVERVIEW_SIGNAL_REQUEST_TIMEOUT_MS = 10 * 1000;

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
    const inFlightRef = useRef(false);

    const refresh = useCallback(async (showLoading = false) => {
        if (inFlightRef.current) {
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
            setSignals(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : '실제 신호 추세를 불러오지 못했습니다.');
        } finally {
            window.clearTimeout(timeoutHandle);
            inFlightRef.current = false;
            setLoading(false);
        }
    }, [crop]);

    useEffect(() => {
        setSignals(null);
        setError(null);
        void refresh(true).catch(() => {
            // Errors are surfaced through hook state.
        });
        const interval = window.setInterval(() => {
            void refresh().catch(() => {
                // Errors are surfaced through hook state.
            });
        }, OVERVIEW_SIGNAL_REFRESH_MS);
        return () => {
            window.clearInterval(interval);
        };
    }, [refresh]);

    return { signals, loading, error, refresh };
}
