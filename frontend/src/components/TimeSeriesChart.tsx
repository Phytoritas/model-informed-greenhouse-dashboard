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
import {
    DASHBOARD_CHART_AXIS_STROKE,
    DASHBOARD_CHART_GRID_STROKE,
    DASHBOARD_CHART_LEGEND_STYLE,
    DASHBOARD_CHART_TICK,
    DASHBOARD_CHART_TOOLTIP_STYLE,
} from './charts/chartStyles';

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
    eyebrow?: string;
}

function TimeSeriesChartInner<T extends { timestamp?: number }>({
    title,
    data,
    dataKeys,
    icon,
    height = 240,
    eyebrow,
}: TimeSeriesChartProps<T>) {
    const { locale } = useLocale();
    const chartData = useStableChartData(data, dataKeys);
    const chartEyebrow = eyebrow ?? (locale === 'ko' ? 'Dashboard trend' : 'Dashboard trend');

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
            <div className="sg-panel flex h-full min-w-0 flex-col items-center justify-center bg-white p-4 text-center text-[color:var(--sg-text-faint)]">
                <p className="sg-eyebrow mb-2">{chartEyebrow}</p>
                <div className="mb-2 flex items-center gap-2 opacity-50">
                    {icon}
                    <span className="font-medium">{title}</span>
                </div>
                <p>{locale === 'ko' ? '데이터를 기다리는 중...' : 'Waiting for data...'}</p>
            </div>
        );
    }

    return (
        <div className="sg-panel min-w-0 bg-white p-3">
            <div className="mb-3 flex min-w-0 items-start justify-between gap-3 text-[color:var(--sg-text)]">
                <div className="min-w-0">
                    <p className="sg-eyebrow">{chartEyebrow}</p>
                    <h3 className="mt-1 truncate text-sm font-bold text-[color:var(--sg-text-strong)]">{title}</h3>
                </div>
                {icon ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]">
                        {icon}
                    </span>
                ) : null}
            </div>
            <ChartFrame style={{ height }} minHeight={height}>
                {({ width, height: containerHeight }) => (
                    <LineChart width={Math.max(width, 1)} height={Math.max(containerHeight, height)} data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={DASHBOARD_CHART_GRID_STROKE} />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={tickFormatter}
                            stroke={DASHBOARD_CHART_AXIS_STROKE}
                            tick={DASHBOARD_CHART_TICK}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={24}
                        />
                        <YAxis stroke={DASHBOARD_CHART_AXIS_STROKE} tick={DASHBOARD_CHART_TICK} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE} labelFormatter={labelFormatter} />
                        <Legend wrapperStyle={DASHBOARD_CHART_LEGEND_STYLE} />
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
