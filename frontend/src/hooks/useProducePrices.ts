import { useEffect, useState } from 'react';
import type { ProducePricesPayload } from '../types';
import { API_URL } from '../config';

export const PRODUCE_PRICE_REFRESH_MS = 15 * 60 * 1000;

export const useProducePrices = () => {
    const [prices, setPrices] = useState<ProducePricesPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchProducePrices = async () => {
            try {
                const res = await fetch(`${API_URL}/market/produce`);
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.detail ?? `HTTP ${res.status}`);
                }
                if (!cancelled) {
                    setPrices(data);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load produce prices.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void fetchProducePrices();
        const interval = window.setInterval(() => {
            void fetchProducePrices();
        }, PRODUCE_PRICE_REFRESH_MS);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    return { prices, loading, error };
};
