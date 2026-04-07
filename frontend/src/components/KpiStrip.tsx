import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';
import { formatMetricValue } from '../utils/formatValue';
import type { SensorHealthStatus } from '../utils/sensorStatus';

export interface KpiTileData {
  key: string;
  label: string;
  value: number | string;
  unit: string;
  status: SensorHealthStatus;
  trend: 'up' | 'down' | 'stable';
  trendDetail: string;
  icon: LucideIcon;
  color: string;
  lastReceived: string | null;
  fractionDigits?: number;
}

interface KpiStripProps {
  statusSummary: string;
  telemetryStatus: 'loading' | 'live' | 'stale' | 'offline';
  primaryTiles: KpiTileData[];
  secondaryTiles: KpiTileData[];
}

const STATUS_CHIP_CLASS: Record<SensorHealthStatus, string> = {
  normal: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-rose-100 text-rose-700',
};

const STATUS_LABEL: Record<SensorHealthStatus, Record<'ko' | 'en', string>> = {
  normal: { ko: '정상', en: 'OK' },
  warning: { ko: '주의', en: 'Warn' },
  critical: { ko: '경고', en: 'Alert' },
};

const TREND_ARROW: Record<KpiTileData['trend'], string> = {
  up: '↗',
  down: '↘',
  stable: '→',
};

const TELEMETRY_DOT_CLASS: Record<KpiStripProps['telemetryStatus'], string> = {
  live: 'bg-emerald-500',
  loading: 'bg-slate-400 animate-pulse',
  stale: 'bg-amber-500',
  offline: 'bg-rose-500',
};

function KpiTile({ tile }: { tile: KpiTileData }) {
  const { locale } = useLocale();
  const Icon = tile.icon;
  const displayValue = typeof tile.value === 'number'
    ? formatMetricValue(tile.value, tile.fractionDigits)
    : tile.value;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <div className={`shrink-0 rounded-lg p-2 ${tile.color} bg-opacity-10`}>
        <Icon className={`h-5 w-5 ${tile.color.replace('bg-', 'text-')}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-500">{tile.label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-slate-900 sm:text-3xl">{displayValue}</span>
          <span className="text-sm text-slate-500">{tile.unit}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CHIP_CLASS[tile.status]}`}>
          {STATUS_LABEL[tile.status][locale]}
        </span>
        <span className={`text-xs font-medium ${
          tile.trend === 'up' ? 'text-red-500' :
          tile.trend === 'down' ? 'text-blue-500' :
          'text-slate-400'
        }`}>
          {TREND_ARROW[tile.trend]}
          {tile.trendDetail ? ` ${tile.trendDetail}` : ''}
        </span>
        {tile.lastReceived && (
          <span className="text-[10px] text-slate-400">{tile.lastReceived}</span>
        )}
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
      {/* Status summary bar */}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${TELEMETRY_DOT_CLASS[telemetryStatus]}`} />
        <span className="text-sm font-medium text-slate-600">{statusSummary}</span>
      </div>

      {/* Primary KPI grid — 4 tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {primaryTiles.map((tile) => (
          <KpiTile key={tile.key} tile={tile} />
        ))}
      </div>

      {/* Secondary sensors — collapsible */}
      {secondaryTiles.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
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
