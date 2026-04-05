import { useState } from 'react';
import {
    ArrowDownRight,
    ArrowUpRight,
    Banknote,
    CalendarDays,
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
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDate, getIntlLocale, type AppLocale } from '../i18n/locale';
import type {
    ProducePriceDirection,
    ProducePriceEntry,
    ProducePricesPayload,
} from '../types';
import { getProduceDisplayName } from '../utils/displayCopy';

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
        accentClassName: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    down: {
        label: locale === 'ko' ? '하락' : 'Down',
        Icon: ArrowDownRight,
        accentClassName: 'border-rose-100 bg-rose-50 text-rose-700',
    },
    flat: {
        label: locale === 'ko' ? '보합' : 'Flat',
        Icon: Minus,
        accentClassName: 'border-slate-100 bg-slate-50 text-slate-600',
    },
});

const localizeMarketLabel = (marketLabel: string, locale: AppLocale): string => {
    if (locale !== 'ko') {
        return marketLabel;
    }

    const normalizedLabel = marketLabel.toLowerCase();
    if (normalizedLabel === 'retail') {
        return '소매';
    }
    if (normalizedLabel === 'wholesale') {
        return '도매';
    }

    return marketLabel;
};

const buildProduceSummary = (prices: ProducePricesPayload, locale: AppLocale): string => {
    const marketLabel = localizeMarketLabel(prices.items[0]?.market_label ?? 'Retail', locale);

    if (locale === 'ko') {
        return `KAMIS ${formatSurveyDay(locale, prices.source.latest_day)} 기준 주요 시설원예 품목 ${prices.items.length}종의 ${marketLabel} 평균가격입니다. 최근 ${prices.trend.history_days}일 실측과 향후 ${prices.trend.forecast_days}일 평년선(3년·5년·10년)을 함께 비교할 수 있습니다.`;
    }

    return `KAMIS ${formatSurveyDay(locale, prices.source.latest_day)} snapshot of ${prices.items.length} featured greenhouse produce items in the ${marketLabel.toLowerCase()} market. Compare trailing ${prices.trend.history_days} days of actual prices with forward 3-year, 5-year, and 10-year seasonal normals.`;
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
    <div className="rounded-md bg-slate-50 px-2 py-2">
        <div>{label}</div>
        <div className="mt-1 font-medium text-slate-700">{formatKrw(locale, price)}</div>
    </div>
);

const ProducePriceCard = ({
    item,
    locale,
}: {
    item: ProducePriceEntry;
    locale: AppLocale;
}) => {
    const direction = getDirectionMeta(locale)[item.direction];

    return (
        <div className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-800">
                        {getProduceDisplayName(item.display_name, locale)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                        {item.source_name} / {item.unit} / {localizeMarketLabel(item.market_label, locale)}
                    </div>
                </div>
                <div
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${direction.accentClassName}`}
                >
                    <direction.Icon className="h-3.5 w-3.5" />
                    <span>{direction.label}</span>
                </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
                <div className="text-xl font-bold text-slate-900">
                    {formatKrw(locale, item.current_price_krw)}
                </div>
                <div className="text-xs font-medium text-slate-500">
                    {item.day_over_day_pct > 0 ? '+' : ''}
                    {item.day_over_day_pct.toFixed(1)}% {locale === 'ko' ? '전일 대비' : 'vs 1d'}
                </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
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
    const availableSeries = prices.trend.series;
    const unavailableSeries = prices.trend.unavailable_series;
    const copy = locale === 'ko'
        ? {
            unavailable: '현재 주요 품목 목록에 대한 KAMIS 추세선 데이터를 불러올 수 없습니다.',
            title: '최근 2주 실측 vs 평년 추세선',
            description: `상단 카드는 최신 KAMIS 조사 스냅샷이고, 차트는 최근 ${prices.trend.history_days}일 소매 평균가격 실측과 향후 ${prices.trend.forecast_days}일 평년선(3년·5년·10년)을 겹쳐 보여줍니다.`,
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
            description: `Cards above use the latest KAMIS item snapshot. The chart history line uses KAMIS retail average prices for the trailing ${prices.trend.history_days} days, while forward lines use matching calendar dates averaged across the prior 3, 5, and 10 years.`,
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {copy.unavailable}
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col rounded-lg border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <LineChartIcon className="h-4 w-4 text-emerald-600" />
                        <span>{copy.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {copy.description}
                    </p>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-right text-[11px] text-slate-500 shadow-sm">
                    <div>{copy.reference}</div>
                    <div className="mt-1 font-semibold text-slate-700">
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
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            series.key === selectedSeries.key
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                        }`}
                    >
                        {getProduceDisplayName(series.display_name, locale)}
                    </button>
                ))}
            </div>

            <div className="mt-4 h-72 lg:h-[22rem]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
                    <LineChart data={selectedSeries.points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(value) => formatShortDate(locale, String(value))}
                            stroke="#94a3b8"
                            tick={{ fontSize: 11 }}
                            minTickGap={16}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value: number) => formatCompactKrw(locale, value)}
                            width={72}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.55)',
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
                            stroke="#94a3b8"
                            strokeDasharray="4 4"
                            label={{ value: copy.ref, position: 'top', fill: '#475569', fontSize: 11 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="actual_price_krw"
                            name={copy.actual}
                            stroke="#0f766e"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="normal_3y_price_krw"
                            name={copy.normal3}
                            stroke="#84cc16"
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
                            stroke="#f59e0b"
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
                            stroke="#6366f1"
                            strokeWidth={2}
                            strokeDasharray="8 4"
                            dot={false}
                            activeDot={{ r: 3 }}
                            connectNulls={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-slate-500 sm:grid-cols-2">
                <div className="rounded-md bg-white px-3 py-2 shadow-sm">
                    <div className="font-medium text-slate-700">{copy.seriesWindow}</div>
                    <div className="mt-1">
                        {copy.windowLabel(selectedSeries.history_days, selectedSeries.forecast_days)}
                    </div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 shadow-sm">
                    <div className="font-medium text-slate-700">{copy.futureCoverage}</div>
                    <div className="mt-1">
                        3y {coverageRangeLabel(selectedSeries.points, 'normal_3y_sample_count', 3)} / 5y {coverageRangeLabel(selectedSeries.points, 'normal_5y_sample_count', 5)} / 10y {coverageRangeLabel(selectedSeries.points, 'normal_10y_sample_count', 10)}
                    </div>
                </div>
            </div>

            {unavailableSeries.length > 0 ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {copy.unavailablePrefix} {unavailableSeries.map((series) => getProduceDisplayName(series.display_name, locale)).join(', ')}. {copy.unavailableSuffix}
                </div>
            ) : null}
        </div>
    );
};

const ProducePricesPanel = ({ prices, loading, error }: ProducePricesPanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            title: '실시간 농산물 가격',
            subtitle: '주요 시설원예 품목 스냅샷과 2주 평년 추세선',
            loading: '실시간 농산물 가격을 불러오는 중...',
            unavailable: '농산물 가격 패널을 불러올 수 없습니다',
            retail: '소매',
        }
        : {
            title: 'Live Produce Prices',
            subtitle: 'Curated greenhouse produce snapshot with 2-week KAMIS seasonal overlays',
            loading: 'Loading live produce prices...',
            unavailable: 'Produce price panel is unavailable',
            retail: 'Retail',
        };

    return (
        <div className="flex h-full flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-slate-800">
                        <Banknote className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-semibold">{copy.title}</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{copy.subtitle}</p>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                    KAMIS
                </div>
            </div>

            {loading ? (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{copy.loading}</div>
            ) : error ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    {copy.unavailable}: {error}
                </div>
            ) : prices ? (
                <div className="flex h-full flex-col space-y-4">
                    <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-lime-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                    <Sprout className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>{prices.source.provider} {prices.source.endpoint}</span>
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                                    {buildProduceSummary(prices, locale)}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-3 py-2 text-right text-xs text-slate-500 shadow-sm">
                                <div className="flex items-center justify-end gap-1">
                                    <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>{formatSurveyDay(locale, prices.source.latest_day)}</span>
                                </div>
                                <div className="mt-1">
                                    {localizeMarketLabel(prices.items[0]?.market_label ?? copy.retail, locale)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(250px,0.95fr)] lg:items-start">
                        <TrendChart prices={prices} locale={locale} />

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            {prices.items.map((item) => (
                                <ProducePriceCard key={item.key} item={item} locale={locale} />
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default ProducePricesPanel;
