import { TrendingUp, Calendar, Leaf, Droplets, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CropType, ForecastData } from "../types";
import { useLocale } from "../i18n/LocaleProvider";
import { UNIT_LABELS, getForecastTitle } from "../utils/displayCopy";

interface ForecastPanelProps {
    forecast: ForecastData | null;
    crop: CropType;
}

const ForecastPanel = ({ forecast, crop }: ForecastPanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            waiting: '예측 데이터를 기다리는 중...',
            noHarvest: '수확 예측 없음',
            noHarvestDescription: '현재 생육 단계 기준으로 향후 7일 내 수확이 예상되지 않습니다.',
            yield: '7일 수확량',
            transpiration: '증산량',
            energyUse: '에너지 사용량',
            harvestYield: '수확량 (kg)',
            cropTranspiration: '작물 증산량 (mm H₂O)',
        }
        : {
            waiting: 'Waiting for forecast data...',
            noHarvest: 'No Harvest Predicted',
            noHarvestDescription: 'No harvest is expected within the next 7 days based on current growth stage.',
            yield: '7-Day Yield',
            transpiration: 'Transpiration',
            energyUse: 'Energy Usage',
            harvestYield: 'Harvest yield (kg)',
            cropTranspiration: 'Crop transpiration (mm H₂O)',
        };
    if (!forecast || !forecast.daily || forecast.daily.length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm h-full flex flex-col items-center justify-center text-slate-400">
                <Calendar className="w-10 h-10 mb-2 opacity-50" />
                <p>{copy.waiting}</p>
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
                            <p className="font-semibold">{copy.noHarvest}</p>
                            <p className="mt-1 text-amber-700">
                                {copy.noHarvestDescription}
                            </p>
                        </div>
                    </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Leaf className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">{copy.yield}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{hasHarvest ? `${forecast.total_harvest_kg?.toFixed(1)}` : "0.0"}</div>
                    <p className="mt-1 text-xs leading-snug text-slate-400">{UNIT_LABELS.weeklyYield}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Droplets className="w-4 h-4 text-cyan-500" />
                        <span className="text-sm font-medium">{copy.transpiration}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{forecast.total_ETc_mm?.toFixed(1) || 0}</div>
                    <p className="mt-1 text-xs leading-snug text-slate-400">{UNIT_LABELS.transpirationDepth}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Zap className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium">{copy.energyUse}</span>
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
                        {getForecastTitle(crop, locale)}
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
                            <Bar dataKey="harvest_kg" name={copy.harvestYield} fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="ETc_mm" name={copy.cropTranspiration} fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ForecastPanel;
