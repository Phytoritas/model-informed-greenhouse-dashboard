import { useEffect, useState } from 'react';
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

    useEffect(() => {
        let cancelled = false;

        const fetchProfiles = async () => {
            try {
                const data = await fetch(`${API_URL}/rtr/profiles`).then((response) => readJson<RtrProfilesPayload>(response));

                if (!cancelled) {
                    setProfiles(data);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load RTR profiles.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void fetchProfiles();

        return () => {
            cancelled = true;
        };
    }, []);

    return { profiles, loading, error };
};
