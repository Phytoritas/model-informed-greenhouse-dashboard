import { useState, useEffect } from 'react';
import { Settings, Sprout, Activity, Droplets, Leaf, CheckCircle } from 'lucide-react';
import type { SensorData, AdvancedModelMetrics, CropType } from '../types';
import { API_URL } from '../config';
import { UNIT_LABELS, getCropStatusLabel } from '../utils/displayCopy';
import { formatMetricValue } from '../utils/formatValue';

interface CropDetailsProps {
    crop: CropType;
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
}

const CropDetails = ({ crop, currentData, metrics }: CropDetailsProps) => {
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

            alert(data?.message ?? 'Configuration updated successfully!');
        } catch (err) {
            console.error("Error updating config:", err);
            alert(err instanceof Error ? err.message : 'Failed to update configuration.');
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

            alert(data?.message ?? 'Pruning baseline reset successfully.');
        } catch (err) {
            console.error("Error pruning:", err);
            alert(err instanceof Error ? err.message : 'Failed to mark pruning.');
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
                        <span>{crop} Management & Operations</span>
                    </div>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        {showSettings ? 'Hide Settings' : 'Show Settings'}
                    </button>
                </div>

                {showSettings && (
                    <div className="p-6 bg-white">
                        {crop === 'Tomato' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Fruits per Truss</label>
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
                                            Update
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Recommended: 3-6 fruits depending on light levels.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Pruning Threshold (Nodes)</label>
                                        <input
                                            type="number"
                                            min="10" max="30"
                                            value={pruningThreshold}
                                            onChange={(e) => setPruningThreshold(Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Target Leaf Count</label>
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
                                        Apply Settings
                                    </button>
                                    <button
                                        onClick={handlePrune}
                                        disabled={pruneLoading}
                                        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        {pruneLoading ? 'Processing...' : 'Mark Pruned'}
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
                        <span className="text-sm font-medium">{crop === 'Tomato' ? 'Truss status' : 'Growth status'}</span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{getCropStatusLabel(crop)}</span>
                            <span className="font-semibold text-slate-800">{growthStatusValue ?? '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Leaf area index</span>
                            <span className="font-semibold text-green-600">{metrics.growth.lai.toFixed(2)}</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-snug">{UNIT_LABELS.leafAreaIndex}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Activity className="w-4 h-4" />
                        <span className="text-sm font-medium">Daily biomass growth</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{metrics.growth.growthRate.toFixed(1)}</div>
                    <p className="text-xs text-slate-400 mt-1 leading-snug">{UNIT_LABELS.biomassGrowthRate}</p>
                    <p className="text-xs text-slate-400 mt-1">Biomass accumulation trend</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Leaf className="w-4 h-4" />
                        <span className="text-sm font-medium">Yield Potential</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">{metrics.yield.predictedWeekly.toFixed(1)}</div>
                    <p className="text-xs text-slate-400 mt-1 leading-snug">{UNIT_LABELS.weeklyYield}</p>
                    <p className="text-xs text-slate-400 mt-1">Confidence: {metrics.yield.confidence}%</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Droplets className="w-4 h-4" />
                        <span className="text-sm font-medium">Transpiration</span>
                    </div>
                    <div className="text-2xl font-bold text-cyan-600">{formatMetricValue(currentData.transpiration)}</div>
                    <p className="text-xs text-slate-400 mt-1 leading-snug">{UNIT_LABELS.transpirationRate}</p>
                    <p className="text-xs text-slate-400 mt-1">Canopy Activity</p>
                </div>
            </div>
        </div>
    );
};

export default CropDetails;
