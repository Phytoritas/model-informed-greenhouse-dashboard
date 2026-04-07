import type {
    AdvancedModelMetrics,
    CropType,
    ForecastData,
    ProducePricesPayload,
    RtrProfile,
    SensorData,
    WeatherOutlook,
} from '../types';
import { buildDashboardRecentSummary } from './recentSummary';
import {
    buildRTRForecastTargets,
    buildRTRLiveSnapshot,
    getRtrProfile,
} from './rtr';

interface BuildAiDashboardContextArgs {
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
    crop: CropType;
    history?: SensorData[];
    forecast?: ForecastData | null;
    producePrices?: ProducePricesPayload | null;
    weather?: WeatherOutlook | null;
    rtrProfile?: RtrProfile | null;
}

const CROP_MARKET_DISPLAY_NAMES: Record<CropType, string[]> = {
    Tomato: ['Tomato', 'Cherry Tomato'],
    Cucumber: ['Cucumber (Dadagi)', 'Cucumber (Chuicheong)'],
};

function pickSeasonalReferencePrice(
    point: ProducePricesPayload['trend']['series'][number]['points'][number] | undefined,
): number | null {
    if (!point) {
        return null;
    }
    return (
        point.normal_5y_price_krw
        ?? point.normal_3y_price_krw
        ?? point.normal_10y_price_krw
        ?? null
    );
}

function buildMarketContext(
    producePrices: ProducePricesPayload | null,
    crop: CropType,
) {
    if (!producePrices) {
        return null;
    }

    const relevantNames = new Set(CROP_MARKET_DISPLAY_NAMES[crop]);
    const compactItems = (
        items: ProducePricesPayload['items'],
        marketKey: 'retail' | 'wholesale',
    ) =>
        items
            .filter((item) => relevantNames.has(item.display_name))
            .slice(0, 2)
            .map((item) => ({
                display_name: item.display_name,
                market_key: marketKey,
                market_label: item.market_label,
                latest_day: item.latest_day,
                current_price_krw: item.current_price_krw,
                direction: item.direction,
                day_over_day_pct: item.day_over_day_pct,
            }));

    const trendItems = producePrices.trend.series
        .filter((series) => relevantNames.has(series.display_name))
        .slice(0, 2)
        .map((series) => {
            const latestActualPoint = [...series.points]
                .reverse()
                .find((point) => point.actual_price_krw !== null);
            const seasonalReferencePrice = pickSeasonalReferencePrice(
                latestActualPoint
                ?? series.points.find((point) => pickSeasonalReferencePrice(point) !== null),
            );
            const latestActualPrice = latestActualPoint?.actual_price_krw ?? null;
            const seasonalBias = latestActualPrice === null || seasonalReferencePrice === null
                ? 'seasonal-reference-unavailable'
                : latestActualPrice >= seasonalReferencePrice * 1.05
                    ? 'above-seasonal-normal'
                    : latestActualPrice <= seasonalReferencePrice * 0.95
                        ? 'below-seasonal-normal'
                        : 'near-seasonal-normal';

            return {
                display_name: series.display_name,
                market_key: producePrices.trend.market_key,
                reference_date: series.reference_date,
                latest_actual_price_krw: latestActualPrice,
                seasonal_reference_price_krw: seasonalReferencePrice,
                seasonal_bias: seasonalBias,
            };
        });

    return {
        source: {
            provider: producePrices.source.provider,
            latest_day: producePrices.source.latest_day,
            fetched_at: producePrices.source.fetched_at,
            auth_mode: producePrices.source.auth_mode,
        },
        summary: producePrices.summary,
        trend_market_key: producePrices.trend.market_key,
        retail_items: compactItems(producePrices.markets.retail?.items ?? [], 'retail'),
        wholesale_items: compactItems(producePrices.markets.wholesale?.items ?? [], 'wholesale'),
        trend_items: trendItems,
    };
}

export function buildAiDashboardContext({
    currentData,
    metrics,
    crop,
    history = [],
    forecast = null,
    producePrices = null,
    weather = null,
    rtrProfile = null,
}: BuildAiDashboardContextArgs) {
    const recentSummary = buildDashboardRecentSummary(currentData, history, 60);
    const effectiveProfile = getRtrProfile(crop, rtrProfile);

    return {
        data: currentData,
        metrics,
        forecast,
        market: buildMarketContext(producePrices, crop),
        recentSummary,
        weather: weather
            ? {
                location: weather.location,
                summary: weather.summary,
                current: weather.current,
                daily: weather.daily.slice(0, 3),
            }
            : null,
        rtr: {
            profile: {
                strategyLabel: effectiveProfile.strategyLabel,
                baseTempC: effectiveProfile.baseTempC,
                slopeCPerMjM2: effectiveProfile.slopeCPerMjM2,
                toleranceC: effectiveProfile.toleranceC,
                calibration: effectiveProfile.calibration,
            },
            live: buildRTRLiveSnapshot(currentData, history, crop, effectiveProfile),
            forecastTargets: buildRTRForecastTargets(weather?.daily ?? [], crop, effectiveProfile).slice(0, 3),
        },
    };
}
