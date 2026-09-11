import { memo, Profiler, useMemo, type ReactNode } from 'react';
import { Droplets, Leaf, Sun, Thermometer, Wind, Zap } from 'lucide-react';
import type { SensorData } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleTime } from '../i18n/locale';
import { useDashboardPerfMetrics } from '../hooks/useDashboardPerfMetrics';
import TimeSeriesChart, { type TimeSeriesDataKey } from './TimeSeriesChart';

interface ChartsProps {
    data: SensorData[];
    variant?: 'default' | 'overview';
    extraChartSlot?: ReactNode;
    /** Replay cursor shared with the 3D twin; null keeps the live view. */
    selectedTimestamp?: number | null;
}

interface ChartCard {
    key: string;
    title: string;
    /**
     * The single unit for this card. Series are grouped so that one card never
     * mixes units on one axis.
     */
    unitLabel: string;
    dataKeys: TimeSeriesDataKey[];
    icon: ReactNode;
}

/**
 * Plot height for the single-screen grid. Short enough that every chart plus a
 * supplied comparison fits one tab without scrolling through topic tabs, tall
 * enough to keep the time axis and the trend shape readable. The overview value
 * matches the chart-slot plot height in RtrTrendCard so a supplied comparison
 * card lines up with the grid row it sits in.
 */
const GRID_CHART_HEIGHT = { overview: 168, default: 176 } as const;

const Charts = ({
    data,
    variant = 'default',
    extraChartSlot = null,
    selectedTimestamp = null,
}: ChartsProps) => {
    const { locale } = useLocale();
    const onRender = useDashboardPerfMetrics('chart-section');

    const copy = useMemo(() => (
        locale === 'ko'
            ? {
                eyebrow: '환경·생육 추세',
                title: '환경·생육 변화',
                description: '같은 시점의 환경과 작물 반응을 비교합니다.',
                lastUpdate: '마지막 갱신',
                chartsLabel: '환경·생육 차트',
                airCanopyTemperature: '기온과 군락 온도',
                airTemperature: '기온',
                canopyTemperature: '군락 온도',
                vpd: '수증기압차(VPD)',
                stomatalConductance: '기공전도도',
                grossPhotosynthesis: '총광합성',
                transpiration: '증산',
                energyBalance: '에너지 수지',
                sensibleHeat: '현열 플럭스 H',
                latentHeat: '잠열 플럭스 LE',
                electricalDemand: '전력 수요',
            }
            : {
                eyebrow: 'Climate and crop trend',
                title: 'Climate and crop change',
                description: 'Compare climate and plant response at the same moment.',
                lastUpdate: 'Last update',
                chartsLabel: 'Climate and crop charts',
                airCanopyTemperature: 'Air and canopy temperature',
                airTemperature: 'Air temperature',
                canopyTemperature: 'Canopy temperature',
                vpd: 'Vapor pressure deficit',
                stomatalConductance: 'Stomatal conductance',
                grossPhotosynthesis: 'Gross photosynthesis',
                transpiration: 'Transpiration',
                energyBalance: 'Energy balance',
                sensibleHeat: 'Sensible heat flux H',
                latentHeat: 'Latent heat flux LE',
                electricalDemand: 'Electrical demand',
            }
    ), [locale]);

    const lastTs = data?.length ? data[data.length - 1].timestamp : null;
    const lastUpdate = lastTs
        ? formatLocaleTime(locale, lastTs, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—';

    // One flat reading order — climate, then plant response, then energy — so the
    // former tab grouping survives as sequence instead of hidden panels.
    const cards = useMemo<ChartCard[]>(() => [
        {
            key: 'air-canopy',
            title: copy.airCanopyTemperature,
            unitLabel: '°C',
            dataKeys: [
                { key: 'temperature', name: copy.airTemperature, seriesIndex: 0 },
                { key: 'canopyTemp', name: copy.canopyTemperature, seriesIndex: 3 },
            ],
            icon: <Thermometer className="h-4 w-4" aria-hidden="true" />,
        },
        {
            key: 'vpd',
            title: copy.vpd,
            unitLabel: 'kPa',
            dataKeys: [{ key: 'vpd', name: copy.vpd, seriesIndex: 0 }],
            icon: <Droplets className="h-4 w-4" aria-hidden="true" />,
        },
        {
            key: 'stomatal-conductance',
            title: copy.stomatalConductance,
            unitLabel: 'mol H₂O m⁻² s⁻¹',
            dataKeys: [{ key: 'stomatalConductance', name: copy.stomatalConductance, seriesIndex: 0 }],
            icon: <Wind className="h-4 w-4" aria-hidden="true" />,
        },
        {
            key: 'photosynthesis',
            title: copy.grossPhotosynthesis,
            unitLabel: 'µmol m⁻² s⁻¹',
            dataKeys: [{ key: 'photosynthesis', name: copy.grossPhotosynthesis, seriesIndex: 3 }],
            icon: <Leaf className="h-4 w-4" aria-hidden="true" />,
        },
        {
            key: 'transpiration',
            title: copy.transpiration,
            unitLabel: 'mm H₂O h⁻¹',
            dataKeys: [{ key: 'transpiration', name: copy.transpiration, seriesIndex: 2 }],
            icon: <Droplets className="h-4 w-4" aria-hidden="true" />,
        },
        {
            key: 'energy-balance',
            title: copy.energyBalance,
            unitLabel: 'W m⁻²',
            dataKeys: [
                { key: 'hFlux', name: copy.sensibleHeat, seriesIndex: 0 },
                { key: 'leFlux', name: copy.latentHeat, seriesIndex: 3 },
            ],
            icon: <Sun className="h-4 w-4" aria-hidden="true" />,
        },
        {
            key: 'electrical-demand',
            title: copy.electricalDemand,
            unitLabel: 'kW',
            dataKeys: [{ key: 'energyUsage', name: copy.electricalDemand, seriesIndex: 2 }],
            icon: <Zap className="h-4 w-4" aria-hidden="true" />,
        },
    ], [copy]);

    const chartHeight = variant === 'overview'
        ? GRID_CHART_HEIGHT.overview
        : GRID_CHART_HEIGHT.default;
    // A hairline gap over the outline color turns the cells into one board with
    // dividers instead of separate floating cards. Four columns only past 1536px,
    // where three columns leave each plot wider than its time axis needs.
    const gridClassName = 'sg-chart-board grid min-w-0 grid-cols-1 gap-px overflow-hidden md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

    return (
        <Profiler id="chart-section" onRender={onRender}>
            <section className="min-w-0" aria-labelledby="overview-dashboard-charts-title" data-testid="overview-dashboard-charts">
                {/* One title line for the whole board; the cards below carry no
                    repeated eyebrow, so the section header is the only heading. */}
                <div className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 id="overview-dashboard-charts-title" className="text-base font-bold text-[color:var(--sg-text-strong)]">{copy.title}</h3>
                    <p className="text-xs text-[color:var(--sg-text-muted)]">
                        {copy.description} · {copy.lastUpdate} {lastUpdate}
                    </p>
                </div>

                <div role="group" aria-label={copy.chartsLabel} className={gridClassName} data-testid="chart-grid">
                    {cards.map((card) => (
                        <TimeSeriesChart
                            key={card.key}
                            title={card.title}
                            data={data}
                            dataKeys={card.dataKeys}
                            unitLabel={card.unitLabel}
                            icon={card.icon}
                            height={chartHeight}
                            eyebrow={copy.eyebrow}
                            compact
                            seamless
                            selectedTimestamp={selectedTimestamp}
                        />
                    ))}
                    {extraChartSlot}
                </div>
            </section>
        </Profiler>
    );
};

export default memo(Charts);
