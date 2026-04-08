import { useEffect, useState } from 'react';
import type { RtrProfilesPayload } from '../types';
import { API_URL } from '../config';

export const useRtrProfiles = () => {
    const [profiles, setProfiles] = useState<RtrProfilesPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchProfiles = async () => {
            try {
                const res = await fetch(`${API_URL}/rtr/profiles`);
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.detail ?? `HTTP ${res.status}`);
                }

                if (!cancelled) {
                    setProfiles({
                        status: data.status,
                        version: data.version,
                        updatedAt: data.updatedAt,
                        mode: data.mode,
                        optimizerEnabled: data.optimizerEnabled,
                        availableModes: data.availableModes,
                        profiles: data.profiles,
                    });
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
