import { memo, Profiler, useMemo } from 'react';
import { Droplets, Sun, Thermometer, Wind, Zap } from 'lucide-react';
import type { SensorData } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleTime } from '../i18n/locale';
import { useDashboardPerfMetrics } from '../hooks/useDashboardPerfMetrics';
import TimeSeriesChart from './TimeSeriesChart';

interface ChartsProps {
    data: SensorData[];
}

const Charts = ({ data }: ChartsProps) => {
    const { locale } = useLocale();
    const onRender = useDashboardPerfMetrics('chart-section');
    const copy = useMemo(() => (
        locale === 'ko'
            ? {
                title: '실시간 환경 분석',
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
                title: 'Real-time Environmental Analysis',
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
                { key: 'temperature', name: copy.airTemperature, color: '#ef4444' },
                { key: 'canopyTemp', name: copy.canopyTemperature, color: '#f59e0b' },
            ],
            icon: <Thermometer className="h-4 w-4 text-red-500" />,
        },
        {
            key: 'vpd-transpiration',
            title: copy.vpdTranspiration,
            dataKeys: [
                { key: 'vpd', name: copy.vpd, color: '#8b5cf6' },
                { key: 'transpiration', name: copy.transpiration, color: '#06b6d4' },
            ],
            icon: <Droplets className="h-4 w-4 text-blue-500" />,
        },
        {
            key: 'photosynthesis',
            title: copy.photosynthesisResponse,
            dataKeys: [
                { key: 'stomatalConductance', name: copy.stomatalConductance, color: '#10b981' },
                { key: 'photosynthesis', name: copy.grossPhotosynthesis, color: '#22c55e' },
            ],
            icon: <Wind className="h-4 w-4 text-green-500" />,
        },
        {
            key: 'energy-balance',
            title: copy.energyBalance,
            dataKeys: [
                { key: 'hFlux', name: copy.sensibleHeat, color: '#fb7185' },
                { key: 'leFlux', name: copy.latentHeat, color: '#0ea5e9' },
            ],
            icon: <Sun className="h-4 w-4 text-amber-500" />,
        },
        {
            key: 'electrical-demand',
            title: copy.electricalDemand,
            dataKeys: [
                { key: 'energyUsage', name: copy.electricalDemandLine, color: '#f59e0b' },
            ],
            icon: <Zap className="h-4 w-4 text-orange-500" />,
        },
    ], [copy]);

    return (
        <Profiler id="chart-section" onRender={onRender}>
            <div className="space-y-6">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-800">{copy.title}</h3>
                    </div>
                    <div className="text-xs text-slate-400">
                        {copy.lastUpdate}: {lastUpdate}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {chartCards.map((card) => (
                        <TimeSeriesChart
                            key={card.key}
                            title={card.title}
                            data={data}
                            dataKeys={card.dataKeys}
                            icon={card.icon}
                            height={200}
                        />
                    ))}
                </div>
            </div>
        </Profiler>
    );
};

export default memo(Charts);
