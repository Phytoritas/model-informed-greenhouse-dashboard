import { useState, useEffect } from 'react';
import { Settings, Sprout, Activity, Droplets, Leaf, CheckCircle } from 'lucide-react';
import type { SensorData, AdvancedModelMetrics, CropType } from '../types';
import { API_URL } from '../config';
import { useLocale } from '../i18n/LocaleProvider';
import { UNIT_LABELS, getCropLabel, getCropStatusLabel } from '../utils/displayCopy';
import { formatMetricValue } from '../utils/formatValue';

interface CropDetailsProps {
    crop: CropType;
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
}

const CropDetails = ({ crop, currentData, metrics }: CropDetailsProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            managementTitle: `${getCropLabel(crop, locale)} 관리 및 작업`,
            hideSettings: '설정 숨기기',
            showSettings: '설정 보기',
            fruitsPerTruss: '화방당 과실 수',
            update: '업데이트',
            fruitsPerTrussHint: '권장값: 광량에 따라 3-6과 수준으로 관리하세요.',
            pruningThreshold: '전정 기준 마디 수',
            targetLeafCount: '목표 엽수',
            applySettings: '설정 적용',
            processing: '처리 중...',
            markPruned: '전정 완료 표시',
            trussStatus: '화방 상태',
            growthStatus: '생육 상태',
            leafAreaIndex: '엽면적지수',
            dailyBiomassGrowth: '일일 생장량',
            biomassTrend: '건물 생산량 추세',
            yieldPotential: '수확 잠재력',
            confidence: '확인 상태',
            transpiration: '증산',
            canopyActivity: '캐노피 활동',
            updateSuccess: '설정을 업데이트했습니다.',
            updateFailure: '설정 업데이트에 실패했습니다.',
            pruneSuccess: '전정 기준을 초기화했습니다.',
            pruneFailure: '전정 처리에 실패했습니다.',
        }
        : {
            managementTitle: `${crop} Management & Operations`,
            hideSettings: 'Hide Settings',
            showSettings: 'Show Settings',
            fruitsPerTruss: 'Fruits per Truss',
            update: 'Update',
            fruitsPerTrussHint: 'Recommended: 3-6 fruits depending on light levels.',
            pruningThreshold: 'Pruning Threshold (Nodes)',
            targetLeafCount: 'Target Leaf Count',
            applySettings: 'Apply Settings',
            processing: 'Processing...',
            markPruned: 'Mark Pruned',
            trussStatus: 'Truss status',
            growthStatus: 'Growth status',
            leafAreaIndex: 'Leaf area index',
            dailyBiomassGrowth: 'Daily biomass growth',
            biomassTrend: 'Biomass accumulation trend',
            yieldPotential: 'Yield Potential',
            confidence: 'Review state',
            transpiration: 'Transpiration',
            canopyActivity: 'Canopy Activity',
            updateSuccess: 'Configuration updated successfully!',
            updateFailure: 'Failed to update configuration.',
            pruneSuccess: 'Pruning baseline reset successfully.',
            pruneFailure: 'Failed to mark pruning.',
        };
    const [showSettings, setShowSettings] = useState(false);

    // Tomato Config
    const [nFruitsPerTruss, setNFruitsPerTruss] = useState(4);

    // Cucumber Config
    const [pruningThreshold, setPruningThreshold] = useState(18);
    const [targetLeafCount, setTargetLeafCount] = useState(15);
    const [pruneLoading, setPruneLoading] = useState(false);
    const growthStatusValue = crop === 'Tomato'
        ? metrics.growth.activeTrusses
        : metrics.growth.nodeCount;

    // Fetch config on mount or crop change
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch(`${API_URL}/config/crop?crop=${crop.toLowerCase()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (crop === 'Tomato') {
                        setNFruitsPerTruss(data.n_fruits_per_truss || 4);
                    } else {
                        setPruningThreshold(data.pruning_threshold || 18);
                        setTargetLeafCount(data.target_leaf_count || 15);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch crop config:", err);
            }
        };
        fetchConfig();
    }, [crop]);

    const handleUpdateConfig = async () => {
        try {
            const body = crop === 'Tomato'
                ? { n_fruits_per_truss: nFruitsPerTruss }
                : { pruning_threshold: pruningThreshold, target_leaf_count: targetLeafCount };

            const res = await fetch(`${API_URL}/config/crop?crop=${crop.toLowerCase()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.detail ?? data?.message ?? 'Failed to update');
            }

            alert(locale === 'ko' ? copy.updateSuccess : data?.message ?? copy.updateSuccess);
        } catch (err) {
            console.error("Error updating config:", err);
            alert(err instanceof Error ? err.message : copy.updateFailure);
        }
    };

    const handlePrune = async () => {
        if (crop !== 'Cucumber') return;
        setPruneLoading(true);
        try {
            const res = await fetch(`${API_URL}/crop/prune?crop=cucumber`, { method: 'POST' });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.detail ?? data?.message ?? 'Failed to prune');
            }

            alert(locale === 'ko' ? copy.pruneSuccess : data?.message ?? copy.pruneSuccess);
        } catch (err) {
            console.error("Error pruning:", err);
            alert(err instanceof Error ? err.message : copy.pruneFailure);
        } finally {
            setPruneLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Control Panel */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold">
                        <Settings className="w-5 h-5 text-slate-500" />
                        <span>{copy.managementTitle}</span>
                    </div>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        {showSettings ? copy.hideSettings : copy.showSettings}
                    </button>
                </div>

                {showSettings && (
                    <div className="p-6 bg-white">
                        {crop === 'Tomato' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{copy.fruitsPerTruss}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="1" max="10"
                                            value={nFruitsPerTruss}
                                            onChange={(e) => setNFruitsPerTruss(Number(e.target.value))}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <button
                                            onClick={handleUpdateConfig}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                        >
                                            {copy.update}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{copy.fruitsPerTrussHint}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{copy.pruningThreshold}</label>
                                        <input
                                            type="number"
                                            min="10" max="30"
                                            value={pruningThreshold}
                                            onChange={(e) => setPruningThreshold(Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{copy.targetLeafCount}</label>
                                        <input
                                            type="number"
                                            min="10" max="30"
                                            value={targetLeafCount}
                                            onChange={(e) => setTargetLeafCount(Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleUpdateConfig}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                    >
                                        {copy.applySettings}
                                    </button>
                                    <button
                                        onClick={handlePrune}
                                        disabled={pruneLoading}
                                        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        {pruneLoading ? copy.processing : copy.markPruned}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Detailed Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Sprout className="w-4 h-4" />
                        <span className="text-sm font-medium">{crop === 'Tomato' ? copy.trussStatus : copy.growthStatus}</span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{getCropStatusLabel(crop, locale)}</span>
                            <span className="font-semibold text-slate-800">{growthStatusValue ?? '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{copy.leafAreaIndex}</span>
                            <span className="font-semibold text-green-600">{metrics.growth.lai.toFixed(2)}</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 leading-snug">{UNIT_LABELS.leafAreaIndex}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Activity className="w-4 h-4" />
                        <span className="text-sm font-medium">{copy.dailyBiomassGrowth}</span>
                    </div>
                    <div className="text-3xl font-bold text-green-700">{metrics.growth.growthRate.toFixed(1)}</div>
                    <p className="text-xs text-slate-500 mt-1 leading-snug">{UNIT_LABELS.biomassGrowthRate}</p>
                    <p className="text-xs text-slate-400 mt-1">{copy.biomassTrend}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Leaf className="w-4 h-4" />
                        <span className="text-sm font-medium">{copy.yieldPotential}</span>
                    </div>
                    <div className="text-3xl font-bold text-emerald-700">{metrics.yield.predictedWeekly.toFixed(1)}</div>
                    <p className="text-xs text-slate-500 mt-1 leading-snug">{UNIT_LABELS.weeklyYield}</p>
                    <p className="text-xs text-slate-400 mt-1">{copy.confidence}: {metrics.yield.confidence}%</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Droplets className="w-4 h-4" />
                        <span className="text-sm font-medium">{copy.transpiration}</span>
                    </div>
                    <div className="text-3xl font-bold text-cyan-700">{formatMetricValue(currentData.transpiration)}</div>
                    <p className="text-xs text-slate-500 mt-1 leading-snug">{UNIT_LABELS.transpirationRate}</p>
                    <p className="text-xs text-slate-400 mt-1">{copy.canopyActivity}</p>
                </div>
            </div>
        </div>
    );
};

export default CropDetails;
