import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ReactNode } from "react";

interface DataKey {
    key: string;
    name: string;
    color: string;
}

type ChartPrimitive = number | string | null | undefined;

interface TimeSeriesChartProps<T extends { timestamp?: number }> {
    title: string;
    data: T[];
    dataKeys: DataKey[];
    icon?: ReactNode;
    height?: number;
}

const TimeSeriesChart = <T extends { timestamp?: number }>({
    title,
    data,
    dataKeys,
    icon,
    height = 240,
}: TimeSeriesChartProps<T>) => {
    // Helper to get nested value like "env.temperature"
    const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
        return path.split('.').reduce<unknown>((acc, part) => {
            if (acc && typeof acc === 'object' && part in acc) {
                return (acc as Record<string, unknown>)[part];
            }
            return undefined;
        }, obj);
    };

    if (!data || data.length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm h-full flex flex-col items-center justify-center text-slate-400">
                <div className="flex items-center gap-2 mb-2 opacity-50">
                    {icon}
                    <span className="font-medium">{title}</span>
                </div>
                <p>Waiting for data...</p>
            </div>
        );
    }

    // Transform data for chart
    const chartData = data.map((item, idx) => {
        const point: Record<string, ChartPrimitive> = { idx, timestamp: item.timestamp };
        const itemRecord = item as Record<string, unknown>;
        dataKeys.forEach(({ key }) => {
            // Handle flat or nested keys
            // If key is like "temperature" (flat) or "env.temperature" (nested)
            // The currentData in App.tsx is flat (SensorData), but history might be different?
            // Let's check useGreenhouse hook.
            // Actually, in App.tsx, history is passed to Charts.
            // Let's assume the data structure matches what we need.
            // If the data is flat (SensorData), we just access it.
            // If it's the nested structure from legacy, we use getNestedValue.
            // Let's support both by checking if getNestedValue returns undefined, try direct access.

            let val = getNestedValue(itemRecord, key);
            if (val === undefined && itemRecord[key] !== undefined) {
                val = itemRecord[key];
            }
            point[key] = typeof val === 'number' || typeof val === 'string' || val == null
                ? val
                : undefined;
        });
        return point;
    });

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-700">
                {icon}
                <h3 className="font-semibold">{title}</h3>
            </div>
            <div style={{ height: height }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={height}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={(t) => t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            stroke="#94a3b8"
                            tick={{ fontSize: 11 }}
                        />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            labelFormatter={(t) => t ? new Date(t).toLocaleString() : ''}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
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
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TimeSeriesChart;
