import { TrendingUp, Calendar, Leaf, Droplets, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CropType, ForecastData } from "../types";
import { UNIT_LABELS, getForecastTitle } from "../utils/displayCopy";

interface ForecastPanelProps {
    forecast: ForecastData | null;
    crop: CropType;
}

const ForecastPanel = ({ forecast, crop }: ForecastPanelProps) => {
    if (!forecast || !forecast.daily || forecast.daily.length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm h-full flex flex-col items-center justify-center text-slate-400">
                <Calendar className="w-10 h-10 mb-2 opacity-50" />
                <p>Waiting for forecast data...</p>
            </div>
        );
    }

    const hasHarvest = (forecast.total_harvest_kg ?? 0) > 0.001;

    return (
        <div className="space-y-6">
            {/* Alert Box if no harvest */}
            {!hasHarvest && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                        <p className="font-semibold">No Harvest Predicted</p>
                        <p className="mt-1 text-amber-700">
                            No harvest is expected within the next 7 days based on current growth stage.
                        </p>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Leaf className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">7-Day Yield</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{hasHarvest ? `${forecast.total_harvest_kg?.toFixed(1)}` : "0.0"}</div>
                    <p className="mt-1 text-xs leading-snug text-slate-400">{UNIT_LABELS.weeklyYield}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Droplets className="w-4 h-4 text-cyan-500" />
                        <span className="text-sm font-medium">Transpiration</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{forecast.total_ETc_mm?.toFixed(1) || 0}</div>
                    <p className="mt-1 text-xs leading-snug text-slate-400">{UNIT_LABELS.transpirationDepth}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Zap className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium">Energy Usage</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{forecast.total_energy_kWh?.toFixed(1) || 0}</div>
                    <p className="mt-1 text-xs leading-snug text-slate-400">{UNIT_LABELS.energyUse}</p>
                </div>
            </div>

            {/* Daily Chart */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-slate-500" />
                        {getForecastTitle(crop)}
                    </h3>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
                        <BarChart data={forecast.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => val.split('-').slice(1).join('/')}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                                cursor={{ fill: '#f8fafc' }}
                                formatter={(value: number, name: string) => [value.toFixed(1), name]}
                            />
                            <Bar dataKey="harvest_kg" name="Harvest yield (kg)" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="ETc_mm" name="Crop transpiration (mm H₂O)" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ForecastPanel;
