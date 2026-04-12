import { describe, expect, it } from 'vitest';
import type { CropType, ProducePriceEntry, ProducePricesPayload } from '../types';
import { selectProduceItemForCrop } from './producePriceSelectors';

function makeItem(overrides: Partial<ProducePriceEntry>): ProducePriceEntry {
    return {
        key: 'item',
        display_name: 'Tomato',
        source_name: 'Tomato/Tomato',
        category_name: 'Vegetable',
        market_label: 'Wholesale',
        unit: '10kg',
        latest_day: '2026-04-10',
        current_price_krw: 10000,
        previous_day_price_krw: 9900,
        month_ago_price_krw: 9500,
        year_ago_price_krw: 9000,
        direction: 'up',
        day_over_day_pct: 1.0,
        raw_day_over_day_pct: 1.0,
        ...overrides,
    };
}

function makePayload(
    wholesaleItems: ProducePriceEntry[],
    retailItems: ProducePriceEntry[],
): ProducePricesPayload {
    return {
        source: {
            provider: 'KAMIS',
            docs_url: 'https://example.com',
            endpoint: 'dailySalesList',
            auth_mode: 'sample',
            fetched_at: '2026-04-10T00:00:00Z',
            latest_day: '2026-04-10',
        },
        summary: 'test',
        items: retailItems,
        markets: {
            wholesale: {
                market_key: 'wholesale',
                market_label: 'Wholesale',
                summary: 'wholesale',
                items: wholesaleItems,
            },
            retail: {
                market_key: 'retail',
                market_label: 'Retail',
                summary: 'retail',
                items: retailItems,
            },
        },
        trend: {
            market_key: 'retail',
            reference_date: '2026-04-10',
            history_days: 14,
            forecast_days: 14,
            normal_year_windows: [3, 5, 10],
            series: [],
            unavailable_series: [],
        },
    };
}

describe('selectProduceItemForCrop', () => {
    it('selects cucumber dadagi variant from wholesale when preferred variant enforcement is enabled', () => {
        const payload = makePayload(
            [
                makeItem({ key: '315', display_name: 'Cucumber (Chuicheong)', source_name: 'Cucumber/Chuicheong' }),
                makeItem({ key: '313', display_name: 'Cucumber (Dadagi)', source_name: 'Cucumber/Dadagi' }),
            ],
            [],
        );

        const selected = selectProduceItemForCrop(payload, 'Cucumber', {
            marketPreference: ['wholesale'],
            enforcePreferredVariant: true,
        });

        expect(selected?.marketKey).toBe('wholesale');
        expect(selected?.item.display_name).toBe('Cucumber (Dadagi)');
    });

    it('selects ripe tomato over cherry tomato when preferred variant enforcement is enabled', () => {
        const payload = makePayload(
            [
                makeItem({ key: '437', display_name: 'Cherry Tomato', source_name: 'Cherry Tomato' }),
                makeItem({ key: '321', display_name: 'Tomato', source_name: 'Tomato/Tomato' }),
            ],
            [],
        );

        const selected = selectProduceItemForCrop(payload, 'Tomato', {
            marketPreference: ['wholesale'],
            enforcePreferredVariant: true,
        });

        expect(selected?.marketKey).toBe('wholesale');
        expect(selected?.item.display_name).toBe('Tomato');
    });

    it('returns null when preferred cucumber variant is unavailable and enforcement is enabled', () => {
        const payload = makePayload(
            [
                makeItem({ key: '315', display_name: 'Cucumber (Chuicheong)', source_name: 'Cucumber/Chuicheong' }),
            ],
            [],
        );

        const selected = selectProduceItemForCrop(payload, 'Cucumber', {
            marketPreference: ['wholesale'],
            enforcePreferredVariant: true,
        });
        expect(selected).toBeNull();
    });

    it('falls back to retail when default market preference is used', () => {
        const payload = makePayload(
            [makeItem({ key: '321', display_name: 'Tomato', source_name: 'Tomato/Tomato' })],
            [makeItem({ key: '313', display_name: 'Cucumber (Dadagi)', source_name: 'Cucumber/Dadagi' })],
        );

        const selected = selectProduceItemForCrop(payload, 'Cucumber' satisfies CropType);
        expect(selected?.marketKey).toBe('retail');
        expect(selected?.item.display_name).toBe('Cucumber (Dadagi)');
    });
});
