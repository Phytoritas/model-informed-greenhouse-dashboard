import { memo, Profiler, useMemo, type ReactNode } from 'react';
import { Droplets, Sun, Thermometer, Wind, Zap } from 'lucide-react';
import type { SensorData } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleTime } from '../i18n/locale';
import { useDashboardPerfMetrics } from '../hooks/useDashboardPerfMetrics';
import TimeSeriesChart from './TimeSeriesChart';

interface ChartsProps {
    data: SensorData[];
    variant?: 'default' | 'overview';
    extraChartSlot?: ReactNode;
}

const Charts = ({ data, variant = 'default', extraChartSlot = null }: ChartsProps) => {
    const { locale } = useLocale();
    const onRender = useDashboardPerfMetrics('chart-section');
    const copy = useMemo(() => (
        locale === 'ko'
            ? {
                eyebrow: 'Dashboard trends',
                title: '실시간 환경 분석',
                description: '온실 환경, 생리 반응, 에너지 흐름을 실시간 추세로 확인합니다.',
                lastUpdate: '마지막 갱신',
                airCanopyTemperature: '기온과 군락 온도',
                airTemperature: '기온 (°C)',
                canopyTemperature: '군락 온도 (°C)',
                vpdTranspiration: '수분부족분과 증산',
                vpd: '수분부족분 (VPD, kPa)',
                transpiration: '증산 속도 (mm H₂O h⁻¹)',
                photosynthesisResponse: '광합성과 기공 반응',
                stomatalConductance: '기공전도도 (mol H₂O m⁻² s⁻¹)',
                grossPhotosynthesis: '총광합성 (µmol m⁻² s⁻¹)',
                energyBalance: '에너지 수지',
                sensibleHeat: '현열 플럭스 H (W m⁻²)',
                latentHeat: '잠열 플럭스 LE (W m⁻²)',
                electricalDemand: '전력 수요',
                electricalDemandLine: '전력 수요 (kW)',
            }
            : {
                eyebrow: 'Dashboard trends',
                title: 'Real-time Environmental Analysis',
                description: 'Greenhouse climate, physiology, and energy flows as live trends.',
                lastUpdate: 'Last update',
                airCanopyTemperature: 'Air and canopy temperature',
                airTemperature: 'Air temperature (°C)',
                canopyTemperature: 'Canopy temperature (°C)',
                vpdTranspiration: 'Vapor pressure deficit and transpiration',
                vpd: 'Vapor pressure deficit (kPa)',
                transpiration: 'Transpiration rate (mm H₂O h⁻¹)',
                photosynthesisResponse: 'Photosynthesis and stomatal response',
                stomatalConductance: 'Stomatal conductance (mol H₂O m⁻² s⁻¹)',
                grossPhotosynthesis: 'Gross photosynthesis (µmol m⁻² s⁻¹)',
                energyBalance: 'Energy balance',
                sensibleHeat: 'Sensible heat flux H (W m⁻²)',
                latentHeat: 'Latent heat flux LE (W m⁻²)',
                electricalDemand: 'Electrical demand',
                electricalDemandLine: 'Electrical demand (kW)',
            }
    ), [locale]);

    const lastTs = data?.length ? data[data.length - 1].timestamp : null;
    const lastUpdate = lastTs
        ? formatLocaleTime(locale, lastTs, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—';
    const chartCards = useMemo(() => [
        {
            key: 'air-canopy',
            title: copy.airCanopyTemperature,
            dataKeys: [
                { key: 'temperature', name: copy.airTemperature, color: 'var(--sg-color-terracotta)' },
                { key: 'canopyTemp', name: copy.canopyTemperature, color: 'var(--sg-accent-amber)' },
            ],
            icon: <Thermometer className="h-4 w-4 text-[color:var(--sg-color-terracotta)]" />,
        },
        {
            key: 'vpd-transpiration',
            title: copy.vpdTranspiration,
            dataKeys: [
                { key: 'vpd', name: copy.vpd, color: 'var(--sg-color-primary)' },
                { key: 'transpiration', name: copy.transpiration, color: 'var(--sg-accent-earth)' },
            ],
            icon: <Droplets className="h-4 w-4 text-[color:var(--sg-accent-earth)]" />,
        },
        {
            key: 'photosynthesis',
            title: copy.photosynthesisResponse,
            dataKeys: [
                { key: 'stomatalConductance', name: copy.stomatalConductance, color: 'var(--sg-color-olive)' },
                { key: 'photosynthesis', name: copy.grossPhotosynthesis, color: 'var(--sg-accent-forest)' },
            ],
            icon: <Wind className="h-4 w-4 text-[color:var(--sg-color-olive)]" />,
        },
        {
            key: 'energy-balance',
            title: copy.energyBalance,
            dataKeys: [
                { key: 'hFlux', name: copy.sensibleHeat, color: 'var(--sg-accent-rose)' },
                { key: 'leFlux', name: copy.latentHeat, color: 'var(--sg-accent-blue)' },
            ],
            icon: <Sun className="h-4 w-4 text-[color:var(--sg-accent-amber)]" />,
        },
        {
            key: 'electrical-demand',
            title: copy.electricalDemand,
            dataKeys: [
                { key: 'energyUsage', name: copy.electricalDemandLine, color: 'var(--sg-accent-amber)' },
            ],
            icon: <Zap className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />,
        },
    ], [copy]);
    const visibleChartCards = chartCards;
    const chartHeight = variant === 'overview' ? 176 : 200;
    const gridClassName = variant === 'overview'
        ? 'grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2'
        : 'grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2';

    return (
        <Profiler id="chart-section" onRender={onRender}>
            <section className="min-w-0 space-y-3" aria-labelledby="overview-dashboard-charts-title" data-testid="overview-dashboard-charts">
                <div className="sg-panel flex min-w-0 flex-col gap-2 bg-[color:var(--sg-surface-raised)] p-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <p className="sg-eyebrow">{copy.eyebrow}</p>
                        <h3 id="overview-dashboard-charts-title" className="mt-1 text-base font-bold text-[color:var(--sg-text-strong)]">{copy.title}</h3>
                        <p className="mt-0.5 max-w-2xl text-[0.7rem] leading-4 text-[color:var(--sg-text-muted)]">{copy.description}</p>
                    </div>
                    <div className="shrink-0 text-xs font-semibold text-[color:var(--sg-text-faint)]">
                        {copy.lastUpdate}: {lastUpdate}
                    </div>
                </div>

                <div className={gridClassName}>
                    {visibleChartCards.map((card) => (
                        <TimeSeriesChart
                            key={card.key}
                            title={card.title}
                            data={data}
                            dataKeys={card.dataKeys}
                            icon={card.icon}
                            height={chartHeight}
                            eyebrow={copy.eyebrow}
                        />
                    ))}
                    {extraChartSlot}
                </div>
            </section>
        </Profiler>
    );
};

export default memo(Charts);
