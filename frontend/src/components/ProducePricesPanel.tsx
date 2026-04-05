import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, LineChart as LineChartIcon, Minus, Sprout } from 'lucide-react';
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
import type {
    ProducePriceDirection,
    ProducePriceEntry,
    ProducePricesPayload,
} from '../types';

interface ProducePricesPanelProps {
    prices: ProducePricesPayload | null;
    loading: boolean;
    error: string | null;
}

const formatKrw = (value: number): string =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
    }).format(value);

const formatCompactKrw = (value: number): string => {
    if (Math.abs(value) >= 10000) {
        return `KRW ${(value / 1000).toFixed(0)}k`;
    }

    return `KRW ${Math.round(value / 100) * 100}`;
};

const formatSurveyDay = (date: string): string => {
    if (!date) {
        return 'Latest survey';
    }

    const surveyDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(surveyDate.getTime())) {
        return date;
    }

    return surveyDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
};

const formatShortDate = (date: string): string => {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return date;
    }

    return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

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

const directionMeta: Record<
    ProducePriceDirection,
    {
        label: string;
        Icon: typeof ArrowUpRight;
        accentClassName: string;
    }
> = {
    up: {
        label: 'Up',
        Icon: ArrowUpRight,
        accentClassName: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    down: {
        label: 'Down',
        Icon: ArrowDownRight,
        accentClassName: 'border-rose-100 bg-rose-50 text-rose-700',
    },
    flat: {
        label: 'Flat',
        Icon: Minus,
        accentClassName: 'border-slate-100 bg-slate-50 text-slate-600',
    },
};

const ComparisonChip = ({
    label,
    price,
}: {
    label: string;
    price: number;
}) => (
    <div className="rounded-md bg-slate-50 px-2 py-2">
        <div>{label}</div>
        <div className="mt-1 font-medium text-slate-700">{formatKrw(price)}</div>
    </div>
);

const ProducePriceCard = ({ item }: { item: ProducePriceEntry }) => {
    const direction = directionMeta[item.direction];

    return (
        <div className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-800">{item.display_name}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                        {item.source_name} / {item.unit}
                    </div>
                </div>
                <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${direction.accentClassName}`}>
                    <direction.Icon className="h-3.5 w-3.5" />
                    <span>{direction.label}</span>
                </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
                <div className="text-xl font-bold text-slate-900">{formatKrw(item.current_price_krw)}</div>
                <div className="text-xs font-medium text-slate-500">
                    {item.day_over_day_pct > 0 ? '+' : ''}{item.day_over_day_pct.toFixed(1)}% vs 1d
                </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <ComparisonChip label="1d ago" price={item.previous_day_price_krw} />
                <ComparisonChip label="1m ago" price={item.month_ago_price_krw} />
            </div>
        </div>
    );
};

const TrendChart = ({
    prices,
}: {
    prices: ProducePricesPayload;
}) => {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const availableSeries = prices.trend.series;
    const unavailableSeries = prices.trend.unavailable_series;

    const selectedSeries =
        availableSeries.find((series) => series.key === selectedKey) ?? availableSeries[0] ?? null;

    if (!selectedSeries) {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                KAMIS trend overlay is unavailable for the current featured produce list.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col rounded-lg border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <LineChartIcon className="h-4 w-4 text-emerald-600" />
                        <span>2-week trend vs seasonal normals</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Cards above use the latest KAMIS item snapshot. The chart history line uses KAMIS retail
                        average prices for the trailing {prices.trend.history_days} days, while forward lines use
                        matching calendar dates averaged across the prior 3, 5, and 10 years.
                    </p>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-right text-[11px] text-slate-500 shadow-sm">
                    <div>Reference</div>
                    <div className="mt-1 font-semibold text-slate-700">
                        {formatSurveyDay(prices.trend.reference_date)}
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
                        {series.display_name}
                    </button>
                ))}
            </div>

            <div className="mt-4 h-72 lg:h-[22rem]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
                    <LineChart data={selectedSeries.points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatShortDate}
                            stroke="#94a3b8"
                            tick={{ fontSize: 11 }}
                            minTickGap={16}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value: number) => formatCompactKrw(value)}
                            width={64}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.55)',
                            }}
                            labelFormatter={(value) => formatSurveyDay(String(value))}
                            formatter={(value, name, item) => {
                                if (typeof value !== 'number') {
                                    return ['No data', name];
                                }

                                const point = item?.payload as ProducePricesPayload['trend']['series'][number]['points'][number] | undefined;
                                if (name === '3y normal') {
                                    return [formatKrw(value), `3y normal (n=${point?.normal_3y_sample_count ?? 0})`];
                                }
                                if (name === '5y normal') {
                                    return [formatKrw(value), `5y normal (n=${point?.normal_5y_sample_count ?? 0})`];
                                }
                                if (name === '10y normal') {
                                    return [formatKrw(value), `10y normal (n=${point?.normal_10y_sample_count ?? 0})`];
                                }

                                return [formatKrw(value), name];
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        <ReferenceLine
                            x={prices.trend.reference_date}
                            stroke="#94a3b8"
                            strokeDasharray="4 4"
                            label={{ value: 'Ref', position: 'top', fill: '#475569', fontSize: 11 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="actual_price_krw"
                            name="Actual avg"
                            stroke="#0f766e"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="normal_3y_price_krw"
                            name="3y normal"
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
                            name="5y normal"
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
                            name="10y normal"
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
                    <div className="font-medium text-slate-700">Series window</div>
                    <div className="mt-1">
                        {selectedSeries.history_days}d actual + {selectedSeries.forecast_days}d forward normals
                    </div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 shadow-sm">
                    <div className="font-medium text-slate-700">Future coverage</div>
                    <div className="mt-1">
                        3y {coverageRangeLabel(selectedSeries.points, 'normal_3y_sample_count', 3)} / 5y {coverageRangeLabel(selectedSeries.points, 'normal_5y_sample_count', 5)} / 10y {coverageRangeLabel(selectedSeries.points, 'normal_10y_sample_count', 10)}
                    </div>
                </div>
            </div>

            {unavailableSeries.length > 0 ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    Trend overlay is unavailable for {unavailableSeries.map((series) => series.display_name).join(', ')}.
                    Snapshot cards remain live even when historical enrichment is missing.
                </div>
            ) : null}
        </div>
    );
};

const ProducePricesPanel = ({ prices, loading, error }: ProducePricesPanelProps) => (
    <div className="flex h-full flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
            <div>
                <div className="flex items-center gap-2 text-slate-800">
                    <Banknote className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-semibold">Live Produce Prices</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">Curated greenhouse produce snapshot with 2-week KAMIS seasonal overlays</p>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                KAMIS
            </div>
        </div>

        {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading live produce prices...</div>
        ) : error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Produce price panel is unavailable: {error}
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
                            <p className="mt-2 text-sm leading-relaxed text-slate-700">{prices.summary}</p>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-3 py-2 text-right text-xs text-slate-500 shadow-sm">
                            <div className="flex items-center justify-end gap-1">
                                <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                                <span>{formatSurveyDay(prices.source.latest_day)}</span>
                            </div>
                            <div className="mt-1">{prices.items[0]?.market_label ?? 'Retail'}</div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(250px,0.95fr)] lg:items-start">
                    <TrendChart prices={prices} />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {prices.items.map((item) => (
                            <ProducePriceCard key={item.key} item={item} />
                        ))}
                    </div>
                </div>
            </div>
        ) : null}
    </div>
);

export default ProducePricesPanel;
