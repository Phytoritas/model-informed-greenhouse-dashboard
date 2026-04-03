import { ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, Minus, Sprout } from 'lucide-react';
import type { ProducePriceDirection, ProducePriceEntry, ProducePricesPayload } from '../types';

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

const formatSurveyDay = (date: string): string => {
    if (!date) {
        return 'Latest survey';
    }

    const surveyDate = new Date(date);
    if (Number.isNaN(surveyDate.getTime())) {
        return date;
    }

    return surveyDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
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
                        {item.source_name} · {item.unit}
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

const ProducePricesPanel = ({ prices, loading, error }: ProducePricesPanelProps) => (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
            <div>
                <div className="flex items-center gap-2 text-slate-800">
                    <Banknote className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-semibold">Live Produce Prices</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">Curated greenhouse produce snapshot from KAMIS retail pricing</p>
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
            <div className="space-y-4">
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

                <div className="space-y-2">
                    {prices.items.map((item) => (
                        <ProducePriceCard key={item.key} item={item} />
                    ))}
                </div>
            </div>
        ) : null}
    </div>
);

export default ProducePricesPanel;
