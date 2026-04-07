import { memo } from 'react';
import type { AdvancedModelMetrics, CropType, ForecastData, MetricHistoryPoint } from '../types';
import { TrendingUp, Zap, Scale, Leaf } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDate, formatLocaleTime, getIntlLocale } from '../i18n/locale';
import { UNIT_LABELS, getCropModelLabel, getDevelopmentStageLabel } from '../utils/displayCopy';

interface ModelAnalyticsProps {
    crop: CropType;
    metrics: AdvancedModelMetrics;
    metricHistory: MetricHistoryPoint[];
    forecast: ForecastData | null;
}

const ModelAnalytics = ({ crop, metrics, metricHistory, forecast }: ModelAnalyticsProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            growthModel: '생육 모델',
            yieldForecast: '수확 예측',
            aiInference: '모델 해석',
            energyModel: '에너지 모델',
            efficiencyCost: '효율 및 비용',
            biomassLine: '바이오매스 (g m⁻²)',
            stage: '단계',
            rate: '증가율',
            harvestForecast: '수확 예측 (kg)',
            confidence: '신뢰도',
            harvestReady: '수확 가능 과실',
            electricalDemand: '전력 수요 (kW)',
            thermalLoad: '열부하 (kW)',
            load: '부하',
            estimatedCost: '예상 비용',
            currentPoint: '현재',
            costPerHour: '시간당',
            optimizationInsight: '최적화 인사이트',
            highEfficiency: '효율이 높게 유지되고 있습니다. 현재 HVAC 반응은 예상 제어 범위 안에 있습니다.',
            efficiencyDrop: '효율 저하가 감지됩니다. 환기 손실과 냉난방 단계 제어를 점검하세요.',
        }
        : {
            growthModel: 'Growth Model',
            yieldForecast: 'Yield Forecast',
            aiInference: 'AI Inference',
            energyModel: 'Energy Model',
            efficiencyCost: 'Efficiency & Cost',
            biomassLine: 'Biomass (g m⁻²)',
            stage: 'Stage',
            rate: 'Rate',
            harvestForecast: 'Harvest forecast (kg)',
            confidence: 'Confidence',
            harvestReady: 'Harvest-ready fruits',
            electricalDemand: 'Electrical demand (kW)',
            thermalLoad: 'Thermal load (kW)',
            load: 'Load',
            estimatedCost: 'Est. Cost',
            currentPoint: 'Now',
            costPerHour: 'per hour',
            optimizationInsight: 'Optimization Insight',
            highEfficiency: 'High efficiency maintained. Current HVAC response is within the expected control envelope.',
            efficiencyDrop: 'Efficiency drop detected. Check ventilation losses and cooling or heating staging.',
        };
    const formatTimeLabel = (timestamp: number) =>
        formatLocaleTime(locale, timestamp, { hour: '2-digit', minute: '2-digit' });
    const formatDayLabel = (date: string) =>
        formatLocaleDate(locale, `${date}T00:00:00`, { month: 'numeric', day: 'numeric' });
    const biomass = metrics.growth.biomass;
    const lai = metrics.growth.lai;
    const predictedWeekly = metrics.yield.predictedWeekly;
    const energyEfficiency = metrics.energy.efficiency;
    const thermalLoadKw = metrics.energy.loadKw ?? metrics.energy.consumption;
    const costPerHour = metrics.energy.costPrediction;
    const costLabel = locale === 'ko'
        ? `${new Intl.NumberFormat(getIntlLocale(locale), {
            style: 'currency',
            currency: 'KRW',
            maximumFractionDigits: 0,
        }).format(Math.max(0, costPerHour))}/${copy.costPerHour}`
        : `$${costPerHour.toFixed(2)}/${copy.costPerHour}`;
    const growthData = metricHistory.length > 0
        ? metricHistory.slice(-18).map((point) => ({
            label: formatTimeLabel(point.timestamp),
            biomass: point.biomass,
            lai: point.lai,
            growthRate: point.growthRate,
        }))
        : [{ label: copy.currentPoint, biomass, lai, growthRate: metrics.growth.growthRate }];
    const yieldData = forecast?.daily?.length
        ? forecast.daily.map((day) => ({
            label: formatDayLabel(day.date),
            harvestKg: day.harvest_kg,
            transpirationMm: day.ETc_mm,
        }))
        : [{
            label: copy.currentPoint,
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
            label: copy.currentPoint,
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
                            <h3 className="font-semibold text-slate-800">{copy.growthModel}</h3>
                            <p className="text-xs text-slate-400">{getCropModelLabel(crop, locale)}</p>
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
                            <Line type="monotone" dataKey="biomass" stroke="#16a34a" strokeWidth={2} dot={false} name={copy.biomassLine} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{copy.stage}: <span className="font-medium text-green-700">{getDevelopmentStageLabel(metrics.growth.developmentStage, locale)}</span></span>
                    <span>{copy.rate}: +{metrics.growth.growthRate.toFixed(1)} g m⁻² d⁻¹</span>
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
                            <h3 className="font-semibold text-slate-800">{copy.yieldForecast}</h3>
                            <p className="text-xs text-slate-400">{copy.aiInference}</p>
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
                            <Bar dataKey="harvestKg" name={copy.harvestForecast} radius={[4, 4, 0, 0]}>
                                {yieldData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#f97316' : '#fdba74'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{copy.confidence}: <span className="font-medium text-orange-700">{metrics.yield.confidence}%</span></span>
                    <span>{copy.harvestReady}: ~{metrics.yield.harvestableFruits.toFixed(0)}</span>
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
                            <h3 className="font-semibold text-slate-800">{copy.energyModel}</h3>
                            <p className="text-xs text-slate-400">{copy.efficiencyCost}</p>
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
                            <Line type="monotone" dataKey="powerKw" stroke="#2563eb" strokeWidth={2} dot={false} name={copy.electricalDemand} />
                            <Line type="monotone" dataKey="loadKw" stroke="#60a5fa" strokeWidth={2} dot={false} name={copy.thermalLoad} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{copy.load}: <span className="font-medium text-slate-700">{thermalLoadKw.toFixed(1)} kW</span></span>
                    <span>{copy.estimatedCost}: <span className="font-medium text-slate-700">{costLabel}</span></span>
                </div>
                <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-bold text-blue-800">{copy.optimizationInsight}</span>
                    </div>
                    <p className="text-xs text-blue-700 leading-snug">
                        {energyEfficiency > 3
                            ? copy.highEfficiency
                            : copy.efficiencyDrop}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default memo(ModelAnalytics);
