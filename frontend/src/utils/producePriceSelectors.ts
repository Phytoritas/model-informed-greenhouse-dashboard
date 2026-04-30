import type {
    CropType,
    ProduceMarketKey,
    ProducePriceEntry,
    ProducePriceTrendSeries,
    ProducePriceTrendUnavailable,
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
    enforcePreferredVariant?: boolean;
}

function normalizeText(value: string | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function normalizeVariantText(value: string | undefined): string {
    return normalizeText(value).replace(/[\s/_()·.-]+/g, '');
}

function includesAny(value: string, keywords: readonly string[]): boolean {
    return keywords.some((keyword) => value.includes(keyword));
}

const FEATURED_PRICE_VARIANT_KEYWORDS = {
    tomato: ['tomato', '\ud1a0\ub9c8\ud1a0'],
    tomatoExcluded: ['cherry', '\ubc29\uc6b8'],
    cucumber: ['cucumber', '\uc624\uc774'],
    chuicheong: ['chuicheong', 'chwi', '\ucde8\uccad'],
    dadagi: ['dadagi', 'baekdadagi', 'baek', '\ub2e4\ub2e4\uae30', '\ubc31\ub2e4\ub2e4\uae30'],
} as const;

function buildPriceVariantHaystack(source: {
    key: string;
    display_name: string;
    source_name?: string;
}): string {
    return normalizeVariantText(`${source.key} ${source.display_name} ${source.source_name ?? ''}`);
}

export function isFeaturedPriceVariant(source: {
    key: string;
    display_name: string;
    source_name?: string;
}): boolean {
    const haystack = buildPriceVariantHaystack(source);
    const isTomato = includesAny(haystack, FEATURED_PRICE_VARIANT_KEYWORDS.tomato)
        && !includesAny(haystack, FEATURED_PRICE_VARIANT_KEYWORDS.tomatoExcluded);
    const isCucumber = includesAny(haystack, FEATURED_PRICE_VARIANT_KEYWORDS.cucumber);
    const isChuicheong = includesAny(haystack, FEATURED_PRICE_VARIANT_KEYWORDS.chuicheong);
    const isDadagi = includesAny(haystack, FEATURED_PRICE_VARIANT_KEYWORDS.dadagi);

    return isTomato || (isCucumber && (isChuicheong || isDadagi));
}

export function filterFeaturedPriceEntries(items: ProducePriceEntry[]): ProducePriceEntry[] {
    return items.filter((item) => isFeaturedPriceVariant(item));
}

export function filterFeaturedPriceTrendSeries(
    series: ProducePriceTrendSeries[],
): ProducePriceTrendSeries[] {
    return series.filter((item) => isFeaturedPriceVariant(item));
}

export function filterFeaturedUnavailablePriceTrendSeries(
    series: ProducePriceTrendUnavailable[],
): ProducePriceTrendUnavailable[] {
    return series.filter((item) => isFeaturedPriceVariant(item));
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

const PREFERRED_VARIANT_KEYWORDS: Record<CropType, string[]> = {
    Tomato: ['tomato'],
    Cucumber: ['dadagi', 'baekdadagi'],
};

const EXCLUDED_VARIANT_KEYWORDS: Record<CropType, string[]> = {
    Tomato: ['cherry'],
    Cucumber: ['chuicheong'],
};

function matchesPreferredVariant(item: ProducePriceEntry, crop: CropType): boolean {
    const haystack = normalizeText(`${item.display_name ?? ''} ${item.source_name ?? ''}`);
    if (EXCLUDED_VARIANT_KEYWORDS[crop].some((keyword) => haystack.includes(keyword))) {
        return false;
    }
    return PREFERRED_VARIANT_KEYWORDS[crop].some((keyword) => haystack.includes(keyword));
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
    const enforcePreferredVariant = options.enforcePreferredVariant ?? false;
    let fallbackMatch: SelectedProduceItem | null = null;

    for (const marketKey of marketPreference) {
        const items = getMarketItems(prices, marketKey);
        const preferredMatch = items.find((item) => matchesPreferredVariant(item, crop));
        if (preferredMatch) {
            return { item: preferredMatch, marketKey };
        }

        if (!fallbackMatch) {
            const matched = items.find((item) => matchesCrop(item, crop));
            if (matched) {
                fallbackMatch = { item: matched, marketKey };
            }
        }
    }

    if (enforcePreferredVariant) {
        return null;
    }

    return fallbackMatch;
}
