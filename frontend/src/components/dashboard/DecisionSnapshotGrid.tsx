import type { CSSProperties } from 'react';
import { CloudSun, Coins, Gauge, Zap } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import type {
    AdvancedModelMetrics,
    CropType,
    ProducePriceTrendSeries,
    ProducePricesPayload,
    SensorData,
    WeatherOutlook,
} from '../../types';
import { getProduceDisplayName, getWeatherLabel } from '../../utils/displayCopy';
import { selectProduceItemForCrop } from '../../utils/producePriceSelectors';
import DashboardCard from '../common/DashboardCard';

interface DecisionSnapshotGridProps {
    crop: CropType;
    currentData: SensorData;
    modelMetrics: AdvancedModelMetrics;
    weather: WeatherOutlook | null;
    weatherLoading: boolean;
    producePrices: ProducePricesPayload | null;
    produceLoading: boolean;
    history?: SensorData[];
}

const clampTwoStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
};

const SPARKLINE_WIDTH = 188;
const SPARKLINE_HEIGHT = 54;

const CROP_KEYWORDS: Record<CropType, string[]> = {
    Tomato: ['tomato', '토마토', '방울토마토', 'cherry tomato'],
    Cucumber: ['cucumber', '오이', 'dadagi', 'chuicheong', '다다기', '취청'],
};

function normalizeText(value: string | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function buildSparklinePath(values: number[]): string {
    if (values.length < 2) {
        return '';
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = SPARKLINE_WIDTH / Math.max(values.length - 1, 1);

    return values
        .map((value, index) => {
            const x = index * stepX;
            const y = SPARKLINE_HEIGHT - ((value - min) / range) * SPARKLINE_HEIGHT;
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');
}

function asFiniteSeries(values: Array<number | null | undefined>): number[] {
    return values.filter((value): value is number => Number.isFinite(value));
}

function matchesCropSeries(series: ProducePriceTrendSeries, crop: CropType): boolean {
    const haystack = normalizeText(`${series.display_name} ${series.source_name}`);
    return CROP_KEYWORDS[crop].some((keyword) => haystack.includes(keyword));
}

function selectTrendSeriesForCrop(
    producePrices: ProducePricesPayload | null,
    crop: CropType,
    preferredKey: string | null,
): ProducePriceTrendSeries | null {
    const seriesList = producePrices?.trend.series ?? [];
    if (seriesList.length === 0) {
        return null;
    }

    if (preferredKey) {
        const matchedByKey = seriesList.find((series) => series.key === preferredKey);
        if (matchedByKey) {
            return matchedByKey;
        }
    }

    const matchedByCrop = seriesList.find((series) => matchesCropSeries(series, crop));
    if (matchedByCrop) {
        return matchedByCrop;
    }

    return seriesList[0] ?? null;
}

function SnapshotTile({
    icon: Icon,
    title,
    headline,
    body,
    tone,
    trendValues,
    trendLabel,
    trendWaiting,
    trendStroke,
}: {
    icon: typeof CloudSun;
    title: string;
    headline: string;
    body: string;
    tone: string;
    trendValues: number[];
    trendLabel: string;
    trendWaiting: string;
    trendStroke: string;
}) {
    const sparklinePath = buildSparklinePath(trendValues);

    return (
        <article className={`flex h-full min-h-[216px] flex-col rounded-[22px] px-4 py-4 ${tone}`} style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/84 text-[color:var(--sg-text-strong)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{title}</div>
            </div>
            <div className="mt-3 text-lg font-semibold leading-tight tracking-[-0.04em] text-[color:var(--sg-text-strong)]" style={clampTwoStyle}>
                {headline}
            </div>
            <div className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]" style={clampTwoStyle}>
                {body}
            </div>

            <div className="mt-auto pt-3">
                {sparklinePath ? (
                    <div className="rounded-[16px] bg-white/82 px-2.5 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        <div className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-[color:var(--sg-text-faint)]">
                            {trendLabel}
                        </div>
                        <svg
                            viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
                            className="h-14 w-full overflow-visible"
                            preserveAspectRatio="none"
                            role="img"
                            aria-label={`${title} ${trendLabel}`}
                        >
                            <path
                                d={sparklinePath}
                                fill="none"
                                stroke={trendStroke}
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                ) : (
                    <div className="rounded-[16px] bg-white/72 px-3 py-2 text-[11px] font-medium text-[color:var(--sg-text-muted)]">
                        {trendWaiting}
                    </div>
                )}
            </div>
        </article>
    );
}

export default function DecisionSnapshotGrid({
    crop,
    currentData,
    modelMetrics,
    weather,
    weatherLoading,
    producePrices,
    produceLoading,
    history = [],
}: DecisionSnapshotGridProps) {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            eyebrow: '보조 흐름',
            title: '날씨 · 시세 · 에너지 · 생육',
            weatherTitle: '외기',
            marketTitle: '시세',
            energyTitle: '에너지',
            cropTitle: '생육',
            weatherLoading: '예보 수집 중',
            marketLoading: '도매 시세 대기',
            marketDelta: '전일 대비',
            marketBasis: '도매 기준',
            leadWeather: '오늘 환기 판단 기준',
            leadMarket: '출하 판단 신호',
            leadEnergy: '현재 소비와 효율',
            leadCrop: '엽면적 지수와 광합성 흐름',
            trendLine: '최근 추세선',
            trendWaiting: '값 들어오는 중',
            won: '원',
        }
        : {
            eyebrow: 'Support signals',
            title: 'Weather · market · energy · crop',
            weatherTitle: 'Weather',
            marketTitle: 'Market',
            energyTitle: 'Energy',
            cropTitle: 'Crop',
            weatherLoading: 'Forecast loading',
            marketLoading: 'Wholesale market loading',
            marketDelta: 'day over day',
            marketBasis: 'Wholesale basis',
            leadWeather: 'Vent and control signal',
            leadMarket: 'Shipping signal',
            leadEnergy: 'Current draw and efficiency',
            leadCrop: 'Canopy and assimilation read',
            trendLine: 'Recent trend line',
            trendWaiting: 'Awaiting trend values',
            won: 'KRW',
        };

    const selectedMarket = selectProduceItemForCrop(producePrices, crop, { marketPreference: ['wholesale'] });
    const leadMarketItem = selectedMarket?.item ?? null;
    const marketSeries = selectTrendSeriesForCrop(producePrices, crop, leadMarketItem?.key ?? null);
    const priceLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
    const weatherHeadline = weatherLoading || !weather
        ? copy.weatherLoading
        : `${weather.current.temperature_c.toFixed(1)}°C · ${getWeatherLabel(weather.current.weather_code, weather.current.weather_label, locale)}`;
    const localizedWeatherBody = weather
        ? locale === 'ko'
            ? `오늘은 ${getWeatherLabel(weather.daily[0]?.weather_code, weather.daily[0]?.weather_label, locale)} 흐름이며 강수 가능성 ${(weather.daily[0]?.precipitation_probability_max_pct ?? 0).toFixed(0)}%, 최대 풍속 ${(weather.daily[0]?.wind_speed_max_kmh ?? 0).toFixed(1)} km/h입니다.`
            : weather.summary
        : copy.leadWeather;
    const marketHeadline = produceLoading || !leadMarketItem
        ? copy.marketLoading
        : `${getProduceDisplayName(leadMarketItem.display_name, locale)} ${leadMarketItem.current_price_krw.toLocaleString(priceLocale)}${copy.won}`;
    const marketDelta = produceLoading || !leadMarketItem
        ? copy.marketLoading
        : `${copy.marketBasis} · ${copy.marketDelta} ${leadMarketItem.day_over_day_pct.toFixed(1)}%`;
    const weatherTrendValues = asFiniteSeries(
        (weather?.daily ?? []).slice(0, 7).map((day) => day.temperature_max_c),
    );
    const marketTrendValues = asFiniteSeries(
        (marketSeries?.points ?? []).map((point) => point.actual_price_krw),
    ).slice(-14);
    const recentHistory = history.slice(-24);
    const energyTrendValues = asFiniteSeries(recentHistory.map((point) => point.energyUsage));
    const cropTrendValues = asFiniteSeries(recentHistory.map((point) => point.photosynthesis));

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={undefined}
            contentClassName="overflow-hidden"
        >
            <div className="grid gap-3 sm:grid-cols-2 sm:auto-rows-fr">
                <SnapshotTile
                    icon={CloudSun}
                    title={copy.weatherTitle}
                    headline={weatherHeadline}
                    body={localizedWeatherBody}
                    tone="sg-tint-amber"
                    trendValues={weatherTrendValues}
                    trendLabel={copy.trendLine}
                    trendWaiting={copy.trendWaiting}
                    trendStroke="#2d5d77"
                />
                <SnapshotTile
                    icon={Coins}
                    title={copy.marketTitle}
                    headline={marketHeadline}
                    body={marketDelta || copy.leadMarket}
                    tone="sg-tint-amber"
                    trendValues={marketTrendValues}
                    trendLabel={copy.trendLine}
                    trendWaiting={copy.trendWaiting}
                    trendStroke="#9d4125"
                />
                <SnapshotTile
                    icon={Zap}
                    title={copy.energyTitle}
                    headline={`${modelMetrics.energy.consumption.toFixed(1)} kW`}
                    body={`${copy.leadEnergy} · ${modelMetrics.energy.efficiency.toFixed(2)} COP`}
                    tone="sg-tint-green"
                    trendValues={energyTrendValues}
                    trendLabel={copy.trendLine}
                    trendWaiting={copy.trendWaiting}
                    trendStroke="#9e4f21"
                />
                <SnapshotTile
                    icon={Gauge}
                    title={copy.cropTitle}
                    headline={`LAI ${modelMetrics.growth.lai.toFixed(2)} · ${currentData.photosynthesis.toFixed(1)}`}
                    body={`${copy.leadCrop} · ${currentData.vpd.toFixed(2)} kPa`}
                    tone="sg-tint-violet"
                    trendValues={cropTrendValues}
                    trendLabel={copy.trendLine}
                    trendWaiting={copy.trendWaiting}
                    trendStroke="#7e2c2d"
                />
            </div>
        </DashboardCard>
    );
}
