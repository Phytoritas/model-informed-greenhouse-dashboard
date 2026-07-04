import { render, screen, within } from '@testing-library/react';
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

    it('renders item prices as metric tile cards with 1-day and 1-month change chips plus KAMIS source basis', () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
        const cucumberItem: ProducePricesPayload['markets']['wholesale']['items'][number] = {
            key: 'cucumber-wholesale',
            display_name: 'Cucumber',
            source_name: 'KAMIS',
            category_name: 'Vegetables',
            market_label: 'Wholesale',
            unit: 'kg',
            latest_day: '2026-04-25',
            current_price_krw: 3600,
            previous_day_price_krw: 3700,
            month_ago_price_krw: 4000,
            year_ago_price_krw: 3500,
            direction: 'down',
            day_over_day_pct: -2.7,
            raw_day_over_day_pct: -2.7,
        };
        const payload: ProducePricesPayload = {
            ...fallbackPayload,
            source: {
                ...fallbackPayload.source,
                auth_mode: 'configured',
                status: undefined,
                fallback_reason: null,
            },
            markets: {
                ...fallbackPayload.markets,
                wholesale: {
                    ...fallbackPayload.markets.wholesale,
                    items: [
                        ...fallbackPayload.markets.wholesale.items,
                        cucumberItem,
                    ],
                },
            },
        };

        render(
            <LocaleProvider>
                <ProducePricesPanel prices={payload} loading={false} error={null} />
            </LocaleProvider>,
        );

        const grid = screen.getByTestId('produce-price-card-grid');
        expect(grid.className.includes('grid')).toBe(true);
        expect(screen.getByTestId('produce-price-card-tomato-wholesale').className.includes('sg-panel')).toBe(true);
        expect(screen.getByTestId('produce-price-card-cucumber-wholesale').className.includes('sg-panel')).toBe(true);
        expect(screen.getAllByText('vs 1d').length).toBeGreaterThan(0);
        expect(screen.getAllByText('vs 1m').length).toBeGreaterThan(0);
        expect(within(screen.getByTestId('produce-change-chips-cucumber-wholesale')).getByText('-10.0%')).toBeTruthy();
        expect(screen.getByText(/Data source: KAMIS/)).toBeTruthy();
        expect(screen.getByText(/Base date:/)).toBeTruthy();
    });

    it('keeps unavailable produce loading and error states from looking like a live KAMIS source', () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');

        const { unmount } = render(
            <LocaleProvider>
                <ProducePricesPanel prices={null} loading error={null} />
            </LocaleProvider>,
        );

        expect(screen.getByText('Loading live produce prices...')).toBeTruthy();
        expect(screen.getByTestId('produce-source-status-chip').className.includes('sg-status-delayed-bg')).toBe(true);

        unmount();

        render(
            <LocaleProvider>
                <ProducePricesPanel prices={null} loading={false} error="KAMIS unavailable" />
            </LocaleProvider>,
        );

        expect(screen.getByText('Produce price panel is unavailable: KAMIS unavailable')).toBeTruthy();
        expect(screen.getByTestId('produce-source-status-chip').className.includes('sg-status-offline-bg')).toBe(true);
    });
});
