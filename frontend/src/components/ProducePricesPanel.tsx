import { useState } from 'react';
import {
    ArrowDownRight,
    ArrowUpRight,
    LineChart as LineChartIcon,
    Minus,
    Sprout,
} from 'lucide-react';
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDate, getIntlLocale, type AppLocale } from '../i18n/locale';
import type {
    ProducePriceDirection,
    ProducePriceEntry,
    ProduceMarketKey,
    ProduceMarketSnapshot,
    ProducePricesPayload,
} from '../types';
import { getProduceDisplayName } from '../utils/displayCopy';
import {
    filterFeaturedPriceEntries,
    filterFeaturedPriceTrendSeries,
    filterFeaturedUnavailablePriceTrendSeries,
} from '../utils/producePriceSelectors';
import ChartFrame from './charts/ChartFrame';
import DashboardCard from './common/DashboardCard';

interface ProducePricesPanelProps {
    prices: ProducePricesPayload | null;
    loading: boolean;
    error: string | null;
}

const formatKrw = (locale: AppLocale, value: number): string =>
    new Intl.NumberFormat(getIntlLocale(locale), {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
    }).format(value);

const formatCompactKrw = (locale: AppLocale, value: number): string => {
    const compactValue = new Intl.NumberFormat(getIntlLocale(locale), {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);

    return locale === 'ko' ? `${compactValue}원` : `KRW ${compactValue}`;
};

const formatSurveyDay = (locale: AppLocale, date: string): string => {
    if (!date) {
        return locale === 'ko' ? '최신 조사일' : 'Latest survey';
    }

    return formatLocaleDate(locale, `${date}T00:00:00`, {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
    });
};

const formatShortDate = (locale: AppLocale, date: string): string =>
    formatLocaleDate(locale, `${date}T00:00:00`, { month: 'short', day: 'numeric' });

const coverageRangeLabel = (
    points: ProducePricesPayload['trend']['series'][number]['points'],
    key: 'normal_3y_sample_count' | 'normal_5y_sample_count' | 'normal_10y_sample_count',
    windowSize: number,
): string => {
    const counts = points
        .filter((point) => point.segment === 'forecast')
        .map((point) => point[key])
        .filter((count) => count > 0);

    if (counts.length === 0) {
        return `n=0/${windowSize}`;
    }

    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    if (minCount === maxCount) {
        return `n=${minCount}/${windowSize}`;
    }

    return `n=${minCount}-${maxCount}/${windowSize}`;
};

const getDirectionMeta = (locale: AppLocale): Record<
    ProducePriceDirection,
    {
        label: string;
        Icon: typeof ArrowUpRight;
        accentClassName: string;
    }
> => ({
    up: {
        label: locale === 'ko' ? '상승' : 'Up',
        Icon: ArrowUpRight,
        accentClassName: 'border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-accent-earth-soft)] text-[color:var(--sg-accent-earth)]',
    },
    down: {
        label: locale === 'ko' ? '하락' : 'Down',
        Icon: ArrowDownRight,
        accentClassName: 'border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary-strong)]',
    },
    flat: {
        label: locale === 'ko' ? '보합' : 'Flat',
        Icon: Minus,
        accentClassName: 'border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] text-[color:var(--sg-text-muted)]',
    },
});

const normalizeMarketKey = (marketLabel: string): ProduceMarketKey | null => {
    const normalizedLabel = marketLabel.trim().toLowerCase();
    if (normalizedLabel === 'retail' || marketLabel.trim() === '소매') {
        return 'retail';
    }
    if (normalizedLabel === 'wholesale' || marketLabel.trim() === '도매') {
        return 'wholesale';
    }

    return null;
};

const localizeMarketLabel = (marketLabel: string, locale: AppLocale): string => {
    const marketKey = normalizeMarketKey(marketLabel);
    if (!marketKey) {
        return marketLabel;
    }

    if (locale === 'ko') {
        return marketKey === 'retail' ? '소매' : '도매';
    }

    return marketKey === 'retail' ? 'Retail' : 'Wholesale';
};

const buildProduceSummary = (
    prices: ProducePricesPayload,
    market: ProduceMarketSnapshot,
    locale: AppLocale,
): string => {
    const marketLabel = localizeMarketLabel(market.market_label, locale);
    if (locale === 'ko') {
        return `토마토·취청오이·백다다기오이 ${marketLabel} 시세 ${market.items.length}개와 최근 ${prices.trend.history_days}일 추세를 함께 봅니다.`;
    }

    return `Tomato, Chuicheong cucumber, and Baekdadagi cucumber only. ${market.items.length} ${marketLabel.toLowerCase()} items with the trailing ${prices.trend.history_days}-day trend.`;

};

const getSourceHealthCopy = (
    prices: ProducePricesPayload,
    locale: AppLocale,
): { label: string; detail: string; degraded: boolean } => {
    if (prices.source.auth_mode === 'fallback') {
        const reason = prices.source.fallback_reason ?? prices.source.status ?? 'live_source_unavailable';
        return {
            label: locale === 'ko' ? '대체 스냅샷' : 'Fallback snapshot',
            detail: locale === 'ko'
                ? `실시간 시세 요청이 지연되어 캐시/샘플 스냅샷을 표시합니다: ${reason}`
                : `Live KAMIS request degraded, so cached or sample prices are shown: ${reason}`,
            degraded: true,
        };
    }

    if (prices.source.auth_mode === 'sample') {
        return {
            label: locale === 'ko' ? '샘플 데이터' : 'Sample data',
            detail: locale === 'ko'
                ? '실시간 시세 연결 정보가 없어 샘플 가격 스냅샷을 표시합니다.'
                : 'Live market access is not ready, so sample prices are shown.',
            degraded: false,
        };
    }

    return {
        label: locale === 'ko' ? '실시간 연결' : 'Live connection',
        detail: locale === 'ko'
            ? '실시간 시세 연결로 최신 가격 스냅샷을 표시합니다.'
            : 'Latest price snapshot is served from the configured KAMIS connection.',
        degraded: false,
    };
};

const ComparisonChip = ({
    label,
    price,
    locale,
}: {
    label: string;
    price: number;
    locale: AppLocale;
}) => (
    <div className="rounded-[18px] bg-white/82 px-3 py-3 shadow-[var(--sg-shadow-card)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">{label}</div>
        <div className="mt-2 font-semibold text-[color:var(--sg-text-strong)]">{formatKrw(locale, price)}</div>
    </div>
);

function MarketMetaTile({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <div
            className="rounded-[24px] bg-white/84 px-4 py-4"
            style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--sg-text-faint)]">
                {label}
            </div>
            <div className="mt-3 text-lg font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]">
                {value}
            </div>
            <div className="mt-2 text-xs leading-6 text-[color:var(--sg-text-muted)]">
                {detail}
            </div>
        </div>
    );
}

const ProducePriceCard = ({
    item,
    locale,
    index,
}: {
    item: ProducePriceEntry;
    locale: AppLocale;
    index: number;
}) => {
    const direction = getDirectionMeta(locale)[item.direction];

    return (
        <div className="relative overflow-hidden rounded-[28px] bg-white/88 p-4 shadow-[var(--sg-shadow-card)]">
            <div className="absolute right-4 top-4 text-sm font-semibold tracking-[-0.05em] text-[color:var(--sg-text-faint)]">
                {String(index + 1).padStart(2, '0')}
            </div>
            <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                    <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                        {getProduceDisplayName(item.display_name, locale)}
                    </div>
                    <div className="mt-1 text-[11px] text-[color:var(--sg-text-muted)]">
                        {item.source_name} / {item.unit} / {localizeMarketLabel(item.market_label, locale)}
                    </div>
                </div>
                <div
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-[var(--sg-shadow-card)] ${direction.accentClassName}`}
                >
                    <direction.Icon className="h-3.5 w-3.5" />
                    <span>{direction.label}</span>
                </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-3">
                <div className="text-xl font-bold text-[color:var(--sg-text-strong)]">
                    {formatKrw(locale, item.current_price_krw)}
                </div>
                <div className="text-xs font-medium text-[color:var(--sg-text-muted)]">
                    {item.day_over_day_pct > 0 ? '+' : ''}
                    {item.day_over_day_pct.toFixed(1)}% {locale === 'ko' ? '전일 대비' : 'vs 1d'}
                </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[color:var(--sg-text-muted)]">
                <ComparisonChip
                    label={locale === 'ko' ? '전일' : '1d ago'}
                    price={item.previous_day_price_krw}
                    locale={locale}
                />
                <ComparisonChip
                    label={locale === 'ko' ? '1개월 전' : '1m ago'}
                    price={item.month_ago_price_krw}
                    locale={locale}
                />
            </div>
        </div>
    );
};

const TrendChart = ({
    prices,
    locale,
}: {
    prices: ProducePricesPayload;
    locale: AppLocale;
}) => {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const availableSeries = filterFeaturedPriceTrendSeries(prices.trend.series);
    const unavailableSeries = filterFeaturedUnavailablePriceTrendSeries(prices.trend.unavailable_series);
    const trendMarketLabel = localizeMarketLabel(prices.trend.market_key, locale);
    const copy = locale === 'ko'
        ? {
            unavailable: '현재 주요 품목 목록에 대한 시세 추세선 데이터를 불러올 수 없습니다.',
            title: '최근 2주 실측과 평년 추세선 비교',
            description: `${trendMarketLabel} 최근 ${prices.trend.history_days}일 실측과 향후 ${prices.trend.forecast_days}일 평년선을 비교합니다.`,
            reference: '기준일',
            noData: '데이터 없음',
            actual: '실측 평균',
            normal3: '3년 평년',
            normal5: '5년 평년',
            normal10: '10년 평년',
            ref: '기준',
            seriesWindow: '표시 구간',
            futureCoverage: '미래 표본 범위',
            windowLabel: (historyDays: number, forecastDays: number) =>
                `실측 ${historyDays}일 + 향후 ${forecastDays}일 평년선`,
            unavailablePrefix: '다음 품목은 추세선이 비활성화되어 있습니다',
            unavailableSuffix: '카드 스냅샷은 계속 실시간으로 표시됩니다.',
        }
        : {
            unavailable: 'KAMIS trend overlay is unavailable for the current featured produce list.',
            title: '2-week trend vs seasonal normals',
            description: `${trendMarketLabel} actual prices for ${prices.trend.history_days} days with forward seasonal normals.`,
            reference: 'Reference',
            noData: 'No data',
            actual: 'Actual avg',
            normal3: '3y normal',
            normal5: '5y normal',
            normal10: '10y normal',
            ref: 'Ref',
            seriesWindow: 'Series window',
            futureCoverage: 'Future coverage',
            windowLabel: (historyDays: number, forecastDays: number) =>
                `${historyDays}d actual + ${forecastDays}d forward normals`,
            unavailablePrefix: 'Trend overlay is unavailable for',
            unavailableSuffix: 'Snapshot cards remain live even when historical enrichment is missing.',
        };

    const selectedSeries =
        availableSeries.find((series) => series.key === selectedKey) ?? availableSeries[0] ?? null;

    if (!selectedSeries) {
        return (
            <div className="rounded-[24px] bg-[color:var(--sg-tint-amber)] p-4 text-sm text-[color:var(--sg-accent-amber)]">
                {copy.unavailable}
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col rounded-[30px] bg-[color:var(--sg-tint-neutral)] p-5 shadow-[var(--sg-shadow-card)]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                        <LineChartIcon className="h-4 w-4 text-[color:var(--sg-accent-earth)]" />
                        <span>{copy.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--sg-text-muted)]">
                        {copy.description}
                    </p>
                </div>
                <div className="rounded-[22px] bg-white/88 px-3 py-2 text-right text-[11px] text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
                    <div>{copy.reference}</div>
                    <div className="mt-1 font-semibold text-[color:var(--sg-text-strong)]">
                        {formatSurveyDay(locale, prices.trend.reference_date)}
                    </div>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {availableSeries.map((series) => (
                    <button
                        key={series.key}
                        type="button"
                        onClick={() => setSelectedKey(series.key)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            series.key === selectedSeries.key
                                ? 'border-transparent bg-[color:var(--sg-accent-forest)] text-white shadow-[var(--sg-shadow-card)]'
                                : 'border-white/70 bg-white/86 text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)]'
                        }`}
                    >
                        {getProduceDisplayName(series.display_name, locale)}
                    </button>
                ))}
            </div>

            <ChartFrame className="mt-4 h-72 lg:h-[22rem]" minHeight={256}>
                {({ width, height }) => (
                    <LineChart width={Math.max(width, 1)} height={Math.max(height, 256)} data={selectedSeries.points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eadccd" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(value) => formatShortDate(locale, String(value))}
                            stroke="#b38b6d"
                            tick={{ fontSize: 11 }}
                            minTickGap={16}
                        />
                        <YAxis
                            stroke="#b38b6d"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value: number) => formatCompactKrw(locale, value)}
                            width={72}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                                border: '1px solid #e4d2bf',
                                borderRadius: '10px',
                                boxShadow: '0 18px 40px -28px rgba(103, 71, 54, 0.45)',
                            }}
                            labelFormatter={(value) => formatSurveyDay(locale, String(value))}
                            formatter={(value, name, item) => {
                                if (typeof value !== 'number') {
                                    return [copy.noData, name];
                                }

                                const point = item?.payload as ProducePricesPayload['trend']['series'][number]['points'][number] | undefined;
                                if (name === copy.normal3) {
                                    return [formatKrw(locale, value), `${copy.normal3} (n=${point?.normal_3y_sample_count ?? 0})`];
                                }
                                if (name === copy.normal5) {
                                    return [formatKrw(locale, value), `${copy.normal5} (n=${point?.normal_5y_sample_count ?? 0})`];
                                }
                                if (name === copy.normal10) {
                                    return [formatKrw(locale, value), `${copy.normal10} (n=${point?.normal_10y_sample_count ?? 0})`];
                                }

                                return [formatKrw(locale, value), name];
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        <ReferenceLine
                            x={prices.trend.reference_date}
                            stroke="#b38b6d"
                            strokeDasharray="4 4"
                            label={{ value: copy.ref, position: 'top', fill: '#475569', fontSize: 11 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="actual_price_krw"
                            name={copy.actual}
                            stroke="#a14a35"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="normal_3y_price_krw"
                            name={copy.normal3}
                            stroke="#7a8f58"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                            activeDot={{ r: 3 }}
                            connectNulls={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="normal_5y_price_krw"
                            name={copy.normal5}
                            stroke="#c98549"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            dot={false}
                            activeDot={{ r: 3 }}
                            connectNulls={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="normal_10y_price_krw"
                            name={copy.normal10}
                            stroke="#8b6b59"
                            strokeWidth={2}
                            strokeDasharray="8 4"
                            dot={false}
                            activeDot={{ r: 3 }}
                            connectNulls={false}
                        />
                    </LineChart>
                )}
            </ChartFrame>

            <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-[color:var(--sg-text-muted)] sm:grid-cols-2">
                <div className="rounded-[18px] bg-white/88 px-3 py-3 shadow-[var(--sg-shadow-card)]">
                    <div className="font-medium text-[color:var(--sg-text-strong)]">{copy.seriesWindow}</div>
                    <div className="mt-1">
                        {copy.windowLabel(selectedSeries.history_days, selectedSeries.forecast_days)}
                    </div>
                </div>
                <div className="rounded-[18px] bg-white/88 px-3 py-3 shadow-[var(--sg-shadow-card)]">
                    <div className="font-medium text-[color:var(--sg-text-strong)]">{copy.futureCoverage}</div>
                    <div className="mt-1">
                        {locale === 'ko'
                            ? `3년 ${coverageRangeLabel(selectedSeries.points, 'normal_3y_sample_count', 3)} / 5년 ${coverageRangeLabel(selectedSeries.points, 'normal_5y_sample_count', 5)} / 10년 ${coverageRangeLabel(selectedSeries.points, 'normal_10y_sample_count', 10)}`
                            : `3y ${coverageRangeLabel(selectedSeries.points, 'normal_3y_sample_count', 3)} / 5y ${coverageRangeLabel(selectedSeries.points, 'normal_5y_sample_count', 5)} / 10y ${coverageRangeLabel(selectedSeries.points, 'normal_10y_sample_count', 10)}`}
                    </div>
                </div>
            </div>

            {unavailableSeries.length > 0 ? (
                <div className="mt-3 rounded-[18px] bg-[color:var(--sg-tint-amber)] px-3 py-3 text-[11px] text-[color:var(--sg-accent-amber)]">
                    {copy.unavailablePrefix} {unavailableSeries.map((series) => getProduceDisplayName(series.display_name, locale)).join(', ')}. {copy.unavailableSuffix}
                </div>
            ) : null}
        </div>
    );
};

const ProducePricesPanel = ({ prices, loading, error }: ProducePricesPanelProps) => {
    const { locale } = useLocale();
    const [selectedMarket, setSelectedMarket] = useState<ProduceMarketKey>('wholesale');
    const copy = locale === 'ko'
        ? {
            title: '오이·토마토 시세 판단',
            subtitle: '소매·도매 스냅샷과 2주 시세 추세선을 재배 의사결정용으로 비교합니다.',
            loading: '실시간 농산물 가격을 불러오는 중...',
            unavailable: '농산물 가격 패널을 불러올 수 없습니다',
            retail: '소매',
            wholesale: '도매',
            noItems: '현재 선택한 시장에 표시할 주요 품목이 없습니다.',
            trendNoteTitle: '추세선 기준',
            trendNote: '시세 추세선은 도매 평균가격을 우선 사용하며, 도매 이력이 없으면 소매 평균가격으로 자동 전환됩니다.',
            surveyBasis: '조사 기준',
            featuredCount: '주요 품목 수',
            trendBasis: '차트 기준',
            leadMarket: '지금 읽을 시장 신호',
            leadItem: '대표 품목',
            livePulse: '시장 펄스',
            currentSelection: '현재 선택',
            sourceLabel: '조사 기준',
            sourceStatus: '조사 상태',
        }
        : {
            title: 'Cucumber and tomato market signals',
            subtitle: 'Compare retail/wholesale snapshots and 2-week KAMIS trends for operating decisions.',
            loading: 'Loading live produce prices...',
            unavailable: 'Produce price panel is unavailable',
            retail: 'Retail',
            wholesale: 'Wholesale',
            noItems: 'No featured produce items are available for the selected market right now.',
            trendNoteTitle: 'Trend basis',
            trendNote: 'KAMIS trend overlays prioritize wholesale average prices and automatically fall back to retail when wholesale history is unavailable.',
            surveyBasis: 'Survey basis',
            featuredCount: 'Featured items',
            trendBasis: 'Chart basis',
            leadMarket: 'Market signal to read first',
            leadItem: 'Lead item',
            livePulse: 'Market pulse',
            currentSelection: 'Current selection',
            sourceLabel: 'Survey basis',
            sourceStatus: 'Survey state',
        };

    const filteredMarkets = prices
        ? {
            retail: {
                ...prices.markets.retail,
                items: filterFeaturedPriceEntries(prices.markets.retail.items),
            },
            wholesale: {
                ...prices.markets.wholesale,
                items: filterFeaturedPriceEntries(prices.markets.wholesale.items),
            },
        }
        : null;
    const visiblePrices = prices && filteredMarkets
        ? {
            ...prices,
            items: filterFeaturedPriceEntries(prices.items ?? []),
            markets: filteredMarkets,
        }
        : null;
    const activeMarketKey: ProduceMarketKey | null = visiblePrices
        ? visiblePrices.markets[selectedMarket].items.length > 0
            ? selectedMarket
            : visiblePrices.markets.retail.items.length > 0
                ? 'retail'
                : visiblePrices.markets.wholesale.items.length > 0
                    ? 'wholesale'
                    : selectedMarket
        : null;
    const activeMarket = visiblePrices && activeMarketKey ? visiblePrices.markets[activeMarketKey] : null;
    const leadMarketItem = activeMarket?.items?.[0] ?? null;
    const sourceHealth = visiblePrices ? getSourceHealthCopy(visiblePrices, locale) : null;

    return (
        <DashboardCard
            eyebrow={locale === 'ko' ? '농산물 시세' : 'KAMIS'}
            title={copy.title}
            description={copy.subtitle}
            className="sg-tint-amber"
            actions={(
                <div className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-amber)] shadow-[var(--sg-shadow-card)]">
                    {sourceHealth?.label ?? (locale === 'ko' ? '농산물 시세' : 'KAMIS')}
                </div>
            )}
        >
            {loading ? (
                <div className="rounded-[26px] bg-white/82 p-5 text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">{copy.loading}</div>
            ) : error ? (
                <div className="rounded-[26px] bg-[color:var(--sg-tint-amber)] p-5 text-sm text-[color:var(--sg-accent-amber)]">
                    {copy.unavailable}: {error}
                </div>
            ) : visiblePrices && activeMarket ? (
                <div className="flex h-full flex-col space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,0.78fr)]">
                        <article
                            className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,rgba(232,241,227,0.96),rgba(255,241,233,0.9))] px-6 py-6"
                            style={{ boxShadow: 'var(--sg-shadow-soft)' }}
                        >
                            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/22 blur-3xl" />
                            <div className="relative flex flex-col gap-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/84"
                                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                        >
                                            <Sprout className="h-6 w-6 text-[color:var(--sg-accent-forest)]" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="sg-eyebrow">{copy.livePulse}</div>
                                            <div className="mt-3 text-[clamp(1.7rem,2.2vw,2.55rem)] font-semibold tracking-[-0.07em] text-[color:var(--sg-text-strong)]">
                                                {localizeMarketLabel(activeMarket.market_label, locale)}
                                            </div>
                                            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--sg-text-muted)]">
                                                {buildProduceSummary(visiblePrices, activeMarket, locale)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="rounded-full bg-white/84 px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-forest)] shadow-[var(--sg-shadow-card)]">
                                        {copy.leadMarket}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {(['retail', 'wholesale'] as ProduceMarketKey[]).map((marketKey) => (
                                        <button
                                            key={marketKey}
                                            type="button"
                                            onClick={() => setSelectedMarket(marketKey)}
                                            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                                                marketKey === activeMarketKey
                                                    ? 'border-transparent bg-[color:var(--sg-accent-forest)] text-white shadow-[var(--sg-shadow-card)]'
                                                    : 'border-white/70 bg-white/80 text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)]'
                                            }`}
                                        >
                                            {marketKey === 'retail' ? copy.retail : copy.wholesale}
                                        </button>
                                    ))}
                                </div>

                                <div className="grid gap-3 md:grid-cols-4">
                                    <MarketMetaTile
                                        label={copy.currentSelection}
                                        value={localizeMarketLabel(activeMarket.market_label, locale)}
                                        detail={visiblePrices.source.provider}
                                    />
                                    <MarketMetaTile
                                        label={copy.surveyBasis}
                                        value={formatSurveyDay(locale, visiblePrices.source.latest_day)}
                                        detail={copy.leadItem}
                                    />
                                    <MarketMetaTile
                                        label={copy.featuredCount}
                                        value={String(activeMarket.items.length)}
                                        detail={leadMarketItem ? getProduceDisplayName(leadMarketItem.display_name, locale) : copy.noItems}
                                    />
                                    <MarketMetaTile
                                        label={copy.sourceStatus}
                                        value={sourceHealth?.label ?? visiblePrices.source.provider}
                                        detail={sourceHealth?.degraded ? sourceHealth.detail : visiblePrices.source.provider}
                                    />
                                </div>
                                {sourceHealth?.degraded ? (
                                    <div className="rounded-[22px] bg-[color:var(--sg-tint-amber)] px-4 py-3 text-xs leading-relaxed text-[color:var(--sg-accent-amber)] shadow-[var(--sg-shadow-card)]">
                                        {sourceHealth.detail}
                                    </div>
                                ) : null}
                            </div>
                        </article>

                        <div className="grid gap-4">
                            <MarketMetaTile
                                label={copy.trendBasis}
                                value={localizeMarketLabel(visiblePrices.trend.market_key, locale)}
                                detail={copy.trendNote}
                            />
                            {leadMarketItem ? (
                                <ProducePriceCard item={leadMarketItem} locale={locale} index={0} />
                            ) : (
                                <div className="rounded-[24px] bg-white/82 px-4 py-5 text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
                                    {copy.noItems}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(250px,0.95fr)] lg:items-start">
                        <div className="space-y-3">
                            {activeMarketKey !== visiblePrices.trend.market_key ? (
                                <div className="rounded-[22px] bg-[color:var(--sg-color-olive-soft)] px-4 py-3 text-[11px] text-[color:var(--sg-color-olive)] shadow-[var(--sg-shadow-card)]">
                                    <div className="font-semibold">{copy.trendNoteTitle}</div>
                                    <div className="mt-1 leading-relaxed">{copy.trendNote}</div>
                                </div>
                            ) : null}
                            <TrendChart prices={visiblePrices} locale={locale} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            {activeMarket.items.length > 1 ? (
                                activeMarket.items.slice(1).map((item, index) => (
                                    <ProducePriceCard key={item.key} item={item} locale={locale} index={index + 1} />
                                ))
                            ) : (
                                <div className="rounded-[24px] bg-white/82 px-4 py-5 text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
                                    {copy.noItems}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </DashboardCard>
    );
};

export default ProducePricesPanel;
