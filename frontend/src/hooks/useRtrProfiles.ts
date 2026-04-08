import { useCallback, useEffect, useState } from 'react';
import type { RtrProfilesPayload } from '../types';
import { API_URL } from '../config';

async function readJson<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
        throw new Error((data as { detail?: string })?.detail ?? `HTTP ${response.status}`);
    }
    return data as T;
}

export const useRtrProfiles = () => {
    const [profiles, setProfiles] = useState<RtrProfilesPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetch(`${API_URL}/rtr/profiles`).then((response) => readJson<RtrProfilesPayload>(response));
            setProfiles(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load RTR profiles.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh().catch(() => {
            // Errors are surfaced through hook state.
        });
    }, [refresh]);

    return { profiles, loading, error, refresh };
};
