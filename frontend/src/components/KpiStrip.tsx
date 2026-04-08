import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';
import { formatMetricValue } from '../utils/formatValue';
import type { SensorHealthStatus } from '../utils/sensorStatus';
import type { SensorFieldState, TelemetryStatus } from '../types';

export interface KpiTileData {
    key: string;
    label: string;
    value: number | string;
    unit: string;
    availabilityState: SensorFieldState;
    availabilityLabel: string;
    healthStatus: SensorHealthStatus;
    trend: 'up' | 'down' | 'stable';
    trendDetail: string;
    icon: LucideIcon;
    color: string;
    lastReceived: string | null;
    fractionDigits?: number;
}

interface KpiStripProps {
    statusSummary: string;
    telemetryStatus: TelemetryStatus;
    primaryTiles: KpiTileData[];
    secondaryTiles: KpiTileData[];
}

const HEALTH_CHIP_CLASS: Record<SensorHealthStatus, string> = {
    normal: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    critical: 'bg-rose-100 text-rose-700',
};

const HEALTH_LABEL: Record<SensorHealthStatus, Record<'ko' | 'en', string>> = {
    normal: { ko: '정상', en: 'OK' },
    warning: { ko: '주의', en: 'Warn' },
    critical: { ko: '경고', en: 'Alert' },
};

const AVAILABILITY_CHIP_CLASS: Record<SensorFieldState, string> = {
    live: 'bg-emerald-50 text-emerald-700',
    delayed: 'bg-amber-50 text-amber-700',
    stale: 'bg-orange-50 text-orange-700',
    offline: 'bg-rose-50 text-rose-700',
    missing: 'bg-slate-100 text-slate-600',
};

const TREND_ARROW: Record<KpiTileData['trend'], string> = {
    up: '↗',
    down: '↘',
    stable: '→',
};

const TELEMETRY_DOT_CLASS: Record<TelemetryStatus, string> = {
    live: 'bg-emerald-500',
    delayed: 'bg-amber-500',
    stale: 'bg-orange-500',
    offline: 'bg-rose-500',
    loading: 'bg-slate-400 animate-pulse',
};

function KpiTile({ tile }: { tile: KpiTileData }) {
    const { locale } = useLocale();
    const Icon = tile.icon;
    const isNumericValue = typeof tile.value === 'number';
    const displayValue = isNumericValue
        ? formatMetricValue(tile.value as number, tile.fractionDigits)
        : tile.value;

    return (
        <div className="flex gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <div className={`shrink-0 rounded-lg p-2 ${tile.color} bg-opacity-10`}>
                <Icon className={`h-5 w-5 ${tile.color.replace('bg-', 'text-')}`} />
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-500">{tile.label}</p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className={`font-bold text-slate-900 ${isNumericValue ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'}`}>
                        {displayValue}
                    </span>
                    {isNumericValue ? <span className="text-sm text-slate-500">{tile.unit}</span> : null}
                </div>

                <div className="mt-3 flex flex-wrap items-start justify-between gap-2 border-t border-slate-100 pt-2">
                    <div className="flex max-w-full flex-wrap gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${AVAILABILITY_CHIP_CLASS[tile.availabilityState]}`}>
                            {tile.availabilityLabel}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${HEALTH_CHIP_CLASS[tile.healthStatus]}`}>
                            {HEALTH_LABEL[tile.healthStatus][locale]}
                        </span>
                    </div>

                    <div className="min-w-0 basis-full text-left sm:basis-auto sm:max-w-[8.5rem] sm:text-right">
                        <span className={`block text-xs font-medium leading-tight ${
                            tile.trend === 'up' ? 'text-red-500'
                                : tile.trend === 'down' ? 'text-blue-500'
                                    : 'text-slate-400'
                        }`}>
                            {TREND_ARROW[tile.trend]}
                            {tile.trendDetail ? ` ${tile.trendDetail}` : ''}
                        </span>
                        {tile.lastReceived && (
                            <span className="mt-1 block break-words text-[10px] leading-tight text-slate-400">
                                {tile.lastReceived}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function KpiStrip({
    statusSummary,
    telemetryStatus,
    primaryTiles,
    secondaryTiles,
}: KpiStripProps) {
    const { locale } = useLocale();
    const [expanded, setExpanded] = useState(false);

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`h-2 w-2 shrink-0 rounded-full ${TELEMETRY_DOT_CLASS[telemetryStatus]}`} />
                <span className="min-w-0 break-words text-sm font-medium text-slate-600">{statusSummary}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {primaryTiles.map((tile) => (
                    <KpiTile key={tile.key} tile={tile} />
                ))}
            </div>

            {secondaryTiles.length > 0 && (
                <div>
                    <button
                        type="button"
                        onClick={() => setExpanded((prev) => !prev)}
                        className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                    >
                        {locale === 'ko' ? '추가 센서' : 'More sensors'}
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {expanded && (
                        <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {secondaryTiles.map((tile) => (
                                <KpiTile key={tile.key} tile={tile} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
