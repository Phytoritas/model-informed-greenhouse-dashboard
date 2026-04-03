import { useEffect, useState } from 'react';
import type { WeatherOutlook } from '../types';
import { API_URL } from '../config';

export const WEATHER_REFRESH_MS = 15 * 60 * 1000;

export const useWeatherOutlook = () => {
    const [weather, setWeather] = useState<WeatherOutlook | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchWeather = async () => {
            try {
                const res = await fetch(`${API_URL}/weather/daegu`);
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.detail ?? `HTTP ${res.status}`);
                }
                if (!cancelled) {
                    setWeather(data);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load weather.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void fetchWeather();
        const interval = window.setInterval(() => {
            void fetchWeather();
        }, WEATHER_REFRESH_MS);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    return { weather, loading, error };
};
