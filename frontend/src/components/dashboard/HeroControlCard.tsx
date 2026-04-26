import type { CSSProperties } from 'react';
import {
    Droplets,
    Gauge,
    Sprout,
    SunMedium,
    Thermometer,
    Wind,
} from 'lucide-react';
import type { CropType, SensorData } from '../../types';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDateTime } from '../../i18n/locale';
import { getCropLabel } from '../../utils/displayCopy';
import TelemetryFreshnessChip from '../status/TelemetryFreshnessChip';
import { StatusChip } from '../ui/status-chip';

interface HeroControlCardProps {
    crop: CropType;
    operatingMode: string;
    primaryNarrative: string;
    summary: string;
    importantIssue: string | null;
    actions: string[];
    confidence: number | null | undefined;
    advisorUpdatedAt?: number | null;
    advisorRefreshing?: boolean;
    currentData?: SensorData;
    telemetryStatus: 'loading' | 'live' | 'delayed' | 'stale' | 'offline' | 'blocked' | 'provisional';
    telemetryDetail?: string | null;
    modelRuntimeSummary?: string | null;
    sourceSinkBalance?: number | null;
    canopyAssimilation?: number | null;
    lai?: number | null;
    onOpenRtr: () => void;
    onOpenAdvisor: () => void;
    onOpenAssistant: () => void;
}

type PreviewStatusTone = 'growth' | 'stable' | 'warning' | 'critical' | 'muted';

const PREVIEW_STATUS_COPY: Record<HeroControlCardProps['telemetryStatus'], { ko: string; en: string; tone: PreviewStatusTone }> = {
    loading: { ko: '로딩', en: 'Loading', tone: 'muted' },
    live: { ko: 'Live', en: 'Live', tone: 'growth' },
    delayed: { ko: '지연', en: 'Delayed', tone: 'warning' },
    stale: { ko: '오래됨', en: 'Stale', tone: 'stable' },
    offline: { ko: '오프라인', en: 'Offline', tone: 'critical' },
    blocked: { ko: '확인 필요', en: 'Blocked', tone: 'warning' },
    provisional: { ko: '임시', en: 'Provisional', tone: 'stable' },
};

const clampOneStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 1,
};

function formatMetric(value: number | null | undefined, digits = 1): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '-';
    }
    return value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function formatMetricWithUnit(
    value: number | null | undefined,
    unit: string,
    digits = 1,
): string {
    const formatted = formatMetric(value, digits);
    return formatted === '-' ? formatted : `${formatted} ${unit}`;
}

export default function HeroControlCard({
    crop,
    operatingMode,
    primaryNarrative,
    summary,
    importantIssue,
    actions,
    confidence,
    advisorUpdatedAt = null,
    advisorRefreshing = false,
    currentData,
    telemetryStatus,
    telemetryDetail,
    sourceSinkBalance,
    canopyAssimilation,
    lai,
}: HeroControlCardProps) {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const telemetrySignal = PREVIEW_STATUS_COPY[telemetryStatus];
    const copy = locale === 'ko'
        ? {
            title: `온실 1 · ${cropLabel}`,
            temp: 'Air Temp',
            rh: 'RH',
            co2: 'CO₂',
            vpd: 'VPD',
            par: 'PAR',
            soilWater: '토양수분',
            sourceSink: 'Source-sink',
            canopy: 'Assimilation',
            lai: 'LAI',
            refreshing: '분석 갱신 중',
            updated: '분석',
        }
        : {
            title: `Greenhouse 1 · ${cropLabel}`,
            temp: 'Air Temp',
            rh: 'RH',
            co2: 'CO₂',
            vpd: 'VPD',
            par: 'PAR',
            soilWater: 'Soil water',
            sourceSink: 'Source-sink',
            canopy: 'Assimilation',
            lai: 'LAI',
            refreshing: 'Refreshing',
            updated: 'Updated',
        };

    const previewTiles = [
        { label: copy.temp, value: `${formatMetric(currentData?.temperature, 1)}°C`, icon: Thermometer },
        { label: copy.rh, value: `${formatMetric(currentData?.humidity, 0)}%`, icon: Droplets },
        { label: copy.co2, value: `${formatMetric(currentData?.co2, 0)} ppm`, icon: Wind },
        { label: copy.vpd, value: `${formatMetric(currentData?.vpd, 2)} kPa`, icon: Gauge },
        { label: copy.par, value: `${formatMetric(currentData?.light, 0)} µmol`, icon: SunMedium },
        { label: copy.soilWater, value: `${formatMetric(currentData?.soilMoisture, 1)}%`, icon: Sprout },
    ];
    const advisorFreshnessLabel = advisorRefreshing
        ? copy.refreshing
        : advisorUpdatedAt
            ? `${copy.updated} ${formatLocaleDateTime(locale, advisorUpdatedAt, {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            })}`
            : operatingMode;

    return (
        <article className="overview-dashboard-preview p-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="text-[0.74rem] font-bold leading-tight text-[color:var(--sg-text-strong)]">
                        {copy.title}
                    </h2>
                    <p className="mt-0.5 text-[0.58rem] font-semibold text-[color:var(--sg-text-faint)]" style={clampOneStyle}>
                        {advisorFreshnessLabel}
                    </p>
                </div>
                <div className="flex flex-nowrap items-center justify-end gap-1.5">
                    <StatusChip tone={telemetrySignal.tone} className="px-2 py-0.5 text-[10px]">{telemetrySignal[locale]}</StatusChip>
                    <TelemetryFreshnessChip status={telemetryStatus} className="gap-1.5 px-2 py-1 text-[10px]" />
                </div>
            </div>

            <div className="overview-dashboard-mini-grid mt-1.5">
                {previewTiles.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="overview-preview-metric">
                        <div className="flex items-center justify-between gap-1 text-[0.58rem] font-semibold text-[color:var(--sg-text-faint)]">
                            <span>{label}</span>
                            <Icon className="h-2.5 w-2.5 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
                        </div>
                        <div className="sg-data-number mt-0.5 text-[0.78rem] font-bold leading-none text-[color:var(--sg-text-strong)]">
                            {value}
                        </div>
                    </div>
                ))}
            </div>

            <div className="overview-preview-chart mt-1.5 p-1" aria-hidden="true">
                <svg viewBox="0 0 260 74" className="h-full w-full overflow-visible" aria-hidden="true" focusable="false">
                    <line x1="0" y1="18" x2="260" y2="18" stroke="rgba(31,41,51,0.08)" strokeWidth="1" />
                    <line x1="0" y1="42" x2="260" y2="42" stroke="rgba(31,41,51,0.08)" strokeWidth="1" />
                    <path d="M4 48 C34 43 54 49 78 37 S122 24 148 38 190 54 224 35 248 30 258 34" fill="none" stroke="var(--sg-color-tomato)" strokeWidth="3" strokeLinecap="round" />
                    <path d="M4 58 C32 56 60 50 82 52 S124 62 152 51 196 38 226 43 250 49 258 44" fill="none" stroke="var(--sg-color-success)" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="78" cy="37" r="3" fill="var(--sg-color-tomato)" />
                    <circle cx="226" cy="43" r="3" fill="var(--sg-color-success)" />
                </svg>
                <div className="mt-0.5 flex items-center gap-3 text-[0.58rem] font-semibold text-[color:var(--sg-text-faint)]">
                    <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[color:var(--sg-color-tomato)]" />Temp</span>
                    <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[color:var(--sg-color-success)]" />RH</span>
                </div>
            </div>

            {actions[0] ? <p className="sr-only">{actions[0]}</p> : null}
            {importantIssue ? <p className="sr-only">{importantIssue}</p> : null}
            <p className="sr-only">{copy.sourceSink}: {formatMetric(sourceSinkBalance, 2)}</p>
            <p className="sr-only">{copy.canopy}: {formatMetricWithUnit(canopyAssimilation, 'µmol/m²/s', 1)}</p>
            <p className="sr-only">{copy.lai}: {formatMetric(lai, 2)}</p>
            {typeof confidence === 'number' ? <p className="sr-only">Advisor confidence: {Math.round(confidence * 100)}%</p> : null}
            {telemetryDetail ? <p className="sr-only">{telemetryDetail}</p> : null}
            <p className="sr-only">{primaryNarrative}</p>
            <p className="sr-only">{summary}</p>
        </article>
    );
}
