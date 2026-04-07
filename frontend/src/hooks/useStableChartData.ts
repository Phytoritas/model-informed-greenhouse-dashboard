import { useMemo } from 'react';
import type { SensorFieldAvailability } from '../types';

interface DataKey {
    key: string;
    name: string;
    color: string;
}

type ChartPrimitive = number | string | null | undefined;
type AvailabilityAware = {
    fieldAvailability?: Partial<SensorFieldAvailability>;
};

const MAX_CHART_POINTS = 96;

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, part) => {
        if (acc && typeof acc === 'object' && part in acc) {
            return (acc as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

function downsampleSeries<T>(series: T[]): T[] {
    if (series.length <= MAX_CHART_POINTS) {
        return series;
    }

    const step = Math.ceil(series.length / MAX_CHART_POINTS);
    return series.filter((_, index) => index === series.length - 1 || index % step === 0);
}

export function useStableChartData<T extends { timestamp?: number } & AvailabilityAware>(
    data: T[],
    dataKeys: DataKey[],
) {
    return useMemo(() => {
        const sampled = downsampleSeries(data ?? []);

        return sampled.map((item, idx) => {
            const point: Record<string, ChartPrimitive> = { idx, timestamp: item.timestamp };
            const itemRecord = item as Record<string, unknown>;
            dataKeys.forEach(({ key }) => {
                const availability = item.fieldAvailability;
                if (
                    availability
                    && key in availability
                    && availability[key as keyof SensorFieldAvailability] === false
                ) {
                    point[key] = null;
                    return;
                }
                let value = getNestedValue(itemRecord, key);
                if (value === undefined && itemRecord[key] !== undefined) {
                    value = itemRecord[key];
                }
                point[key] =
                    typeof value === 'number' || typeof value === 'string' || value == null
                        ? value
                        : undefined;
            });
            return point;
        });
    }, [data, dataKeys]);
}
