import { memo, useCallback } from 'react';
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDateTime, formatLocaleTime } from '../i18n/locale';
import { useStableChartData } from '../hooks/useStableChartData';
import ChartFrame from './charts/ChartFrame';

interface DataKey {
    key: string;
    name: string;
    color: string;
}

interface TimeSeriesChartProps<T extends { timestamp?: number }> {
    title: string;
    data: T[];
    dataKeys: DataKey[];
    icon?: ReactNode;
    height?: number;
}

const TOOLTIP_STYLE = {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.10)',
} as const;

const LEGEND_STYLE = { fontSize: '12px', paddingTop: '10px' } as const;

function TimeSeriesChartInner<T extends { timestamp?: number }>({
    title,
    data,
    dataKeys,
    icon,
    height = 240,
}: TimeSeriesChartProps<T>) {
    const { locale } = useLocale();
    const chartData = useStableChartData(data, dataKeys);

    const tickFormatter = useCallback(
        (timestamp: number | string | null | undefined) =>
            timestamp ? formatLocaleTime(locale, Number(timestamp), { hour: '2-digit', minute: '2-digit' }) : '',
        [locale],
    );
    const labelFormatter = useCallback(
        (timestamp: number | string | null | undefined) =>
            timestamp ? formatLocaleDateTime(locale, Number(timestamp)) : '',
        [locale],
    );

    if (!data || data.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-6 text-slate-400 shadow-sm">
                <div className="mb-2 flex items-center gap-2 opacity-50">
                    {icon}
                    <span className="font-medium">{title}</span>
                </div>
                <p>{locale === 'ko' ? '데이터를 기다리는 중...' : 'Waiting for data...'}</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-slate-700">
                {icon}
                <h3 className="font-semibold">{title}</h3>
            </div>
            <ChartFrame style={{ height }} minHeight={height}>
                {({ width, height: containerHeight }) => (
                    <LineChart width={Math.max(width, 1)} height={Math.max(containerHeight, height)} data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={tickFormatter}
                            stroke="#94a3b8"
                            tick={{ fontSize: 11 }}
                            minTickGap={24}
                        />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={labelFormatter} />
                        <Legend wrapperStyle={LEGEND_STYLE} />
                        {dataKeys.map(({ key, name, color }) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                name={name}
                                stroke={color}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                                isAnimationActive={false}
                                connectNulls
                            />
                        ))}
                    </LineChart>
                )}
            </ChartFrame>
        </div>
    );
}

const TimeSeriesChart = memo(TimeSeriesChartInner) as typeof TimeSeriesChartInner;

export default TimeSeriesChart;
