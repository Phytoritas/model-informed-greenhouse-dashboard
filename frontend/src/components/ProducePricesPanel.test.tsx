import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../i18n/locale';
import type { ProducePricesPayload } from '../types';
import ProducePricesPanel from './ProducePricesPanel';

const fallbackPayload: ProducePricesPayload = {
    source: {
        provider: 'KAMIS',
        docs_url: 'https://example.test/kamis',
        endpoint: '/market/produce',
        auth_mode: 'fallback',
        fetched_at: '2026-04-26T09:00:00+09:00',
        latest_day: '2026-04-25',
        status: 'fallback-unavailable',
        fallback_reason: 'configured KAMIS request timed out',
    },
    summary: 'Fallback produce snapshot',
    items: [
        {
            key: 'tomato-wholesale',
            display_name: 'Tomato',
            source_name: 'KAMIS',
            category_name: 'Vegetables',
            market_label: 'Wholesale',
            unit: 'kg',
            latest_day: '2026-04-25',
            current_price_krw: 4200,
            previous_day_price_krw: 4100,
            month_ago_price_krw: 3900,
            year_ago_price_krw: 3700,
            direction: 'up',
            day_over_day_pct: 2.4,
            raw_day_over_day_pct: 2.4,
        },
    ],
    markets: {
        retail: {
            market_key: 'retail',
            market_label: 'Retail',
            summary: 'Retail fallback',
            items: [],
        },
        wholesale: {
            market_key: 'wholesale',
            market_label: 'Wholesale',
            summary: 'Wholesale fallback',
            items: [
                {
                    key: 'tomato-wholesale',
                    display_name: 'Tomato',
                    source_name: 'KAMIS',
                    category_name: 'Vegetables',
                    market_label: 'Wholesale',
                    unit: 'kg',
                    latest_day: '2026-04-25',
                    current_price_krw: 4200,
                    previous_day_price_krw: 4100,
                    month_ago_price_krw: 3900,
                    year_ago_price_krw: 3700,
                    direction: 'up',
                    day_over_day_pct: 2.4,
                    raw_day_over_day_pct: 2.4,
                },
            ],
        },
    },
    trend: {
        market_key: 'wholesale',
        reference_date: '2026-04-25',
        history_days: 14,
        forecast_days: 7,
        normal_year_windows: [3, 5, 10],
        series: [],
        unavailable_series: [],
    },
};

describe('ProducePricesPanel', () => {
    it('surfaces backend fallback source status instead of presenting it as a live KAMIS snapshot', () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');

        render(
            <LocaleProvider>
                <ProducePricesPanel prices={fallbackPayload} loading={false} error={null} />
            </LocaleProvider>,
        );

        expect(screen.getAllByText('Fallback snapshot').length).toBeGreaterThan(0);
        expect(
            screen.getAllByText(/Live KAMIS request degraded, so cached or sample prices are shown/).length,
        ).toBeGreaterThan(0);
        expect(screen.getAllByText('configured KAMIS request timed out', { exact: false }).length).toBeGreaterThan(0);
    });
});
