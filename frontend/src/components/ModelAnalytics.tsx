import { memo } from 'react';
import type { AdvancedModelMetrics, CropType, ForecastData, MetricHistoryPoint } from '../types';
import { TrendingUp, Zap, Scale, Leaf } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { UNIT_LABELS, getCropModelLabel } from '../utils/displayCopy';

interface ModelAnalyticsProps {
    crop: CropType;
    metrics: AdvancedModelMetrics;
    metricHistory: MetricHistoryPoint[];
    forecast: ForecastData | null;
}

const formatTimeLabel = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDayLabel = (date: string) =>
    new Date(date).toLocaleDateString([], { month: 'numeric', day: 'numeric' });

const ModelAnalytics = ({ crop, metrics, metricHistory, forecast }: ModelAnalyticsProps) => {
    const biomass = metrics.growth.biomass;
    const lai = metrics.growth.lai;
    const predictedWeekly = metrics.yield.predictedWeekly;
    const energyEfficiency = metrics.energy.efficiency;
    const thermalLoadKw = metrics.energy.loadKw ?? metrics.energy.consumption;
    const costPerHour = metrics.energy.costPrediction;
    const costLabel = costPerHour > 50
        ? `₩${Math.round(costPerHour).toLocaleString()}/h`
        : `$${costPerHour.toFixed(2)}/h`;
    const growthData = metricHistory.length > 0
        ? metricHistory.slice(-18).map((point) => ({
            label: formatTimeLabel(point.timestamp),
            biomass: point.biomass,
            lai: point.lai,
            growthRate: point.growthRate,
        }))
        : [{ label: 'Now', biomass, lai, growthRate: metrics.growth.growthRate }];
    const yieldData = forecast?.daily?.length
        ? forecast.daily.map((day) => ({
            label: formatDayLabel(day.date),
            harvestKg: day.harvest_kg,
            transpirationMm: day.ETc_mm,
        }))
        : [{
            label: 'Now',
            harvestKg: predictedWeekly,
            transpirationMm: 0,
        }];
    const energyData = metricHistory.length > 0
        ? metricHistory.slice(-18).map((point) => ({
            label: formatTimeLabel(point.timestamp),
            powerKw: point.energyConsumption,
            loadKw: point.energyLoadKw,
        }))
        : [{
            label: 'Now',
            powerKw: metrics.energy.consumption,
            loadKw: thermalLoadKw,
        }];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Growth Model Card */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600">
                            <Leaf className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">Growth Model</h3>
                            <p className="text-xs text-slate-400">{getCropModelLabel(crop)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-slate-800">{lai.toFixed(1)}</p>
                        <p className="text-[11px] text-slate-400">{UNIT_LABELS.leafAreaIndex}</p>
                    </div>
                </div>

                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={160}>
                        <LineChart data={growthData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                itemStyle={{ fontSize: '12px' }}
                                formatter={(value: number, name: string) => [value.toFixed(1), name]}
                            />
                            <Line type="monotone" dataKey="biomass" stroke="#16a34a" strokeWidth={2} dot={false} name="Biomass (g m⁻²)" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>Stage: <span className="font-medium text-green-700">{metrics.growth.developmentStage}</span></span>
                    <span>Rate: +{metrics.growth.growthRate.toFixed(1)} g m⁻² d⁻¹</span>
                </div>
            </div>

            {/* Yield Prediction Card */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                            <Scale className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">Yield Forecast</h3>
                            <p className="text-xs text-slate-400">AI Inference</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-slate-800">{predictedWeekly.toFixed(1)}</p>
                        <p className="text-[11px] text-slate-400">{UNIT_LABELS.weeklyYield}</p>
                    </div>
                </div>

                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={160}>
                        <BarChart data={yieldData} barSize={20}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                itemStyle={{ fontSize: '12px' }}
                                formatter={(value: number, name: string) => [value.toFixed(1), name]}
                            />
                            <Bar dataKey="harvestKg" name="Harvest forecast (kg)" radius={[4, 4, 0, 0]}>
                                {yieldData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#f97316' : '#fdba74'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>Confidence: <span className="font-medium text-orange-700">{metrics.yield.confidence}%</span></span>
                    <span>Harvest-ready fruits: ~{metrics.yield.harvestableFruits.toFixed(0)}</span>
                </div>
            </div>

            {/* Energy Efficiency Card */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <Zap className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">Energy Model</h3>
                            <p className="text-xs text-slate-400">Efficiency & Cost</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1 text-slate-800">
                            <p className="text-lg font-bold">{energyEfficiency.toFixed(1)}</p>
                            <p className="text-xs font-normal text-slate-400">COP</p>
                        </div>
                    </div>
                </div>

                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={160}>
                        <LineChart data={energyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                itemStyle={{ fontSize: '12px' }}
                                formatter={(value: number, name: string) => [value.toFixed(2), name]}
                            />
                            <Line type="monotone" dataKey="powerKw" stroke="#2563eb" strokeWidth={2} dot={false} name="Electrical demand (kW)" />
                            <Line type="monotone" dataKey="loadKw" stroke="#60a5fa" strokeWidth={2} dot={false} name="Thermal load (kW)" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>Load: <span className="font-medium text-slate-700">{thermalLoadKw.toFixed(1)} kW</span></span>
                    <span>Est. Cost: <span className="font-medium text-slate-700">{costLabel}</span></span>
                </div>
                <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-bold text-blue-800">Optimization Insight</span>
                    </div>
                    <p className="text-xs text-blue-700 leading-snug">
                        {energyEfficiency > 3
                            ? 'High efficiency maintained. Current HVAC response is within the expected control envelope.'
                            : 'Efficiency drop detected. Check ventilation losses and cooling or heating staging.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default memo(ModelAnalytics);
