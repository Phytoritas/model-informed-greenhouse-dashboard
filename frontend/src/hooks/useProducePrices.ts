import { useEffect, useState } from 'react';
import type {
    ProduceMarketKey,
    ProduceMarketSnapshot,
    ProducePricesPayload,
} from '../types';
import { API_URL } from '../config';

export const PRODUCE_PRICE_REFRESH_MS = 15 * 60 * 1000;
const PRODUCE_PRICE_RECOVERY_REFRESH_MS = 5000;
const PRODUCE_PRICE_REQUEST_TIMEOUT_MS = 6000;

const inferMarketKey = (marketLabel: string | undefined): ProduceMarketKey =>
    marketLabel === '도매' || marketLabel?.toLowerCase() === 'wholesale'
        ? 'wholesale'
        : 'retail';

const buildFallbackMarket = (
    marketKey: ProduceMarketKey,
    payload: ProducePricesPayload,
): ProduceMarketSnapshot => {
    const fallbackItemMarketKey = inferMarketKey(payload.items[0]?.market_label);
    const items = fallbackItemMarketKey === marketKey ? payload.items : [];

    return {
        market_key: marketKey,
        market_label: marketKey === 'retail' ? 'Retail' : 'Wholesale',
        summary:
            items.length > 0
                ? payload.summary
                : `KAMIS live market panel is waiting for featured ${marketKey} produce prices.`,
        items,
    };
};

const normalizeProducePayload = (payload: ProducePricesPayload): ProducePricesPayload => ({
    ...payload,
    markets: {
        retail: payload.markets?.retail ?? buildFallbackMarket('retail', payload),
        wholesale: payload.markets?.wholesale ?? buildFallbackMarket('wholesale', payload),
    },
    trend: {
        ...payload.trend,
        market_key: payload.trend.market_key ?? 'retail',
    },
});

export const useProducePrices = () => {
    const [prices, setPrices] = useState<ProducePricesPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasPrices = prices !== null;
    const refreshMs = hasPrices ? PRODUCE_PRICE_REFRESH_MS : PRODUCE_PRICE_RECOVERY_REFRESH_MS;

    useEffect(() => {
        let cancelled = false;

        const fetchProducePrices = async () => {
            if (!hasPrices && !cancelled) {
                setLoading(true);
            }
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), PRODUCE_PRICE_REQUEST_TIMEOUT_MS);
            try {
                const res = await fetch(`${API_URL}/market/produce`, {
                    signal: controller.signal,
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.detail ?? `HTTP ${res.status}`);
                }
                if (!cancelled) {
                    setPrices(normalizeProducePayload(data as ProducePricesPayload));
                    setError(null);
                }
            } catch (err) {
                if (cancelled && err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
                if (!cancelled) {
                    const message =
                        err instanceof DOMException && err.name === 'AbortError'
                            ? 'Produce price request timed out.'
                            : err instanceof Error
                                ? err.message
                                : 'Failed to load produce prices.';
                    setError(message);
                }
            } finally {
                window.clearTimeout(timeoutId);
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void fetchProducePrices();
        const interval = window.setInterval(() => {
            void fetchProducePrices();
        }, refreshMs);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [hasPrices, refreshMs]);

    return { prices, loading, error };
};
