import type {
    CropType,
    ProduceMarketKey,
    ProducePriceEntry,
    ProducePricesPayload,
} from '../types';

const CROP_MATCH_KEYWORDS: Record<CropType, string[]> = {
    Tomato: ['tomato', '토마토', '방울토마토', 'cherry tomato'],
    Cucumber: ['cucumber', '오이', 'dadagi', 'chuicheong', '다다기', '취청'],
};

export interface SelectedProduceItem {
    item: ProducePriceEntry;
    marketKey: ProduceMarketKey;
}

interface SelectProduceItemOptions {
    marketPreference?: ProduceMarketKey[];
}

function normalizeText(value: string | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function getMarketItems(
    prices: ProducePricesPayload,
    marketKey: ProduceMarketKey,
): ProducePriceEntry[] {
    const marketItems = prices.markets?.[marketKey]?.items;
    if (Array.isArray(marketItems)) {
        return marketItems;
    }

    // Legacy payload compatibility: top-level items generally mirror retail.
    return marketKey === 'retail' ? (prices.items ?? []) : [];
}

function matchesCrop(item: ProducePriceEntry, crop: CropType): boolean {
    const haystack = normalizeText(`${item.display_name ?? ''} ${item.source_name ?? ''}`);
    return CROP_MATCH_KEYWORDS[crop].some((keyword) => haystack.includes(keyword));
}

export function selectProduceItemForCrop(
    prices: ProducePricesPayload | null,
    crop: CropType,
    options: SelectProduceItemOptions = {},
): SelectedProduceItem | null {
    if (!prices) {
        return null;
    }

    const marketPreference = options.marketPreference ?? ['wholesale', 'retail'];

    for (const marketKey of marketPreference) {
        const matched = getMarketItems(prices, marketKey).find((item) => matchesCrop(item, crop));
        if (matched) {
            return { item: matched, marketKey };
        }
    }

    return null;
}
