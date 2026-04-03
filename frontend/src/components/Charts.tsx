import { memo } from 'react';
import { Thermometer, Droplets, Wind, Zap, Sun } from 'lucide-react';
import type { SensorData } from '../types';
import TimeSeriesChart from './TimeSeriesChart';

interface ChartsProps {
    data: SensorData[];
}

const Charts = ({ data }: ChartsProps) => {
    const lastTs = data?.length ? data[data.length - 1].timestamp : null;
    const lastUpdate = lastTs ? new Date(lastTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-800">Real-time Environmental Analysis</h3>
                </div>
                <div className="text-xs text-slate-400">Last update: {lastUpdate}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TimeSeriesChart
                    title="Air and canopy temperature"
                    data={data}
                    dataKeys={[
                        { key: "temperature", name: "Air temperature (°C)", color: "#ef4444" },
                        { key: "canopyTemp", name: "Canopy temperature (°C)", color: "#f59e0b" }
                    ]}
                    icon={<Thermometer className="w-4 h-4 text-red-500" />}
                    height={200}
                />

                <TimeSeriesChart
                    title="Vapor pressure deficit and transpiration"
                    data={data}
                    dataKeys={[
                        { key: "vpd", name: "Vapor pressure deficit (kPa)", color: "#8b5cf6" },
                        { key: "transpiration", name: "Transpiration rate (mm H₂O h⁻¹)", color: "#06b6d4" }
                    ]}
                    icon={<Droplets className="w-4 h-4 text-blue-500" />}
                    height={200}
                />

                <TimeSeriesChart
                    title="Photosynthesis and stomatal response"
                    data={data}
                    dataKeys={[
                        { key: "stomatalConductance", name: "Stomatal conductance (mol H₂O m⁻² s⁻¹)", color: "#10b981" },
                        { key: "photosynthesis", name: "Gross photosynthesis (µmol m⁻² s⁻¹)", color: "#22c55e" }
                    ]}
                    icon={<Wind className="w-4 h-4 text-green-500" />}
                    height={200}
                />

                <TimeSeriesChart
                    title="Energy balance"
                    data={data}
                    dataKeys={[
                        { key: "hFlux", name: "Sensible heat flux H (W m⁻²)", color: "#fb7185" },
                        { key: "leFlux", name: "Latent heat flux LE (W m⁻²)", color: "#0ea5e9" }
                    ]}
                    icon={<Sun className="w-4 h-4 text-amber-500" />}
                    height={200}
                />

                <TimeSeriesChart
                    title="Electrical demand"
                    data={data}
                    dataKeys={[
                        { key: "energyUsage", name: "Electrical demand (kW)", color: "#f59e0b" }
                    ]}
                    icon={<Zap className="w-4 h-4 text-orange-500" />}
                    height={200}
                />
            </div>
        </div>
    );
};

export default memo(Charts);
