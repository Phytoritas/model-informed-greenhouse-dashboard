import { useState, useEffect } from 'react';
import { Sprout, Activity, Droplets, Leaf, CheckCircle } from 'lucide-react';
import type { SensorData, AdvancedModelMetrics, CropType } from '../types';
import { API_URL } from '../config';
import { useLocale } from '../i18n/LocaleProvider';
import { getReadinessDescriptor, type ReadinessTone } from '../lib/design/readiness';
import { UNIT_LABELS, getCropLabel, getCropStatusLabel } from '../utils/displayCopy';
import { formatMetricValue } from '../utils/formatValue';
import DashboardCard from './common/DashboardCard';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MetricCard, type MetricTone } from './ui/metric-card';

const READINESS_METRIC_TONE: Record<ReadinessTone, MetricTone> = {
    success: 'growth',
    info: 'stable',
    warning: 'warning',
    neutral: 'muted',
};

interface CropDetailsProps {
    crop: CropType;
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
}

const CropDetails = ({ crop, currentData, metrics }: CropDetailsProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            managementEyebrow: 'Crop Operations',
            managementTitle: `${getCropLabel(crop, locale)} 관리 및 작업`,
            managementDescription: '작물 설정을 조정하고 전정 작업을 기록합니다.',
            growthTrendChip: '생장 진행',
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
            confidence: '반영 상태',
            transpiration: '증산',
            canopyActivity: '캐노피 활동',
            updateSuccess: '설정을 업데이트했습니다.',
            updateFailure: '설정 업데이트에 실패했습니다.',
            pruneSuccess: '전정 기준을 초기화했습니다.',
            pruneFailure: '전정 처리에 실패했습니다.',
        }
        : {
            managementEyebrow: 'Crop Operations',
            managementTitle: `${crop} Management & Operations`,
            managementDescription: 'Adjust crop configuration and record pruning operations.',
            growthTrendChip: 'Growing',
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
            confidence: 'Readiness',
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
    const readiness = getReadinessDescriptor(metrics.yield.confidence, locale);
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
            <DashboardCard
                eyebrow={copy.managementEyebrow}
                title={copy.managementTitle}
                description={copy.managementDescription}
                actions={(
                    <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
                        {showSettings ? copy.hideSettings : copy.showSettings}
                    </Button>
                )}
            >
                {showSettings ? (
                    crop === 'Tomato' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[color:var(--sg-text-strong)] mb-1">{copy.fruitsPerTruss}</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        min="1" max="10"
                                        value={nFruitsPerTruss}
                                        onChange={(e) => setNFruitsPerTruss(Number(e.target.value))}
                                        className="flex-1"
                                    />
                                    <Button variant="primary" onClick={handleUpdateConfig}>
                                        {copy.update}
                                    </Button>
                                </div>
                                <p className="text-xs text-[color:var(--sg-text-muted)] mt-1">{copy.fruitsPerTrussHint}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[color:var(--sg-text-strong)] mb-1">{copy.pruningThreshold}</label>
                                    <Input
                                        type="number"
                                        min="10" max="30"
                                        value={pruningThreshold}
                                        onChange={(e) => setPruningThreshold(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[color:var(--sg-text-strong)] mb-1">{copy.targetLeafCount}</label>
                                    <Input
                                        type="number"
                                        min="10" max="30"
                                        value={targetLeafCount}
                                        onChange={(e) => setTargetLeafCount(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="primary" className="flex-1" onClick={handleUpdateConfig}>
                                    {copy.applySettings}
                                </Button>
                                <button
                                    onClick={handlePrune}
                                    disabled={pruneLoading}
                                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-accent-forest)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--sg-shadow-card)] hover:brightness-[1.03] disabled:opacity-50"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    {pruneLoading ? copy.processing : copy.markPruned}
                                </button>
                            </div>
                        </div>
                    )
                ) : null}
            </DashboardCard>

            {/* Detailed Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                    icon={Sprout}
                    label={crop === 'Tomato' ? copy.trussStatus : copy.growthStatus}
                    value={String(growthStatusValue ?? '-')}
                    unit={getCropStatusLabel(crop, locale)}
                    tone="stable"
                    trend="stable"
                    trendLabel={`LAI ${metrics.growth.lai.toFixed(2)}`}
                    detail={`${copy.leafAreaIndex} ${UNIT_LABELS.leafAreaIndex}`}
                />
                <MetricCard
                    icon={Activity}
                    label={copy.dailyBiomassGrowth}
                    value={metrics.growth.growthRate.toFixed(1)}
                    unit={UNIT_LABELS.biomassGrowthRate}
                    tone="growth"
                    trend="up"
                    trendLabel={copy.growthTrendChip}
                    detail={copy.biomassTrend}
                />
                <MetricCard
                    icon={Leaf}
                    label={copy.yieldPotential}
                    value={metrics.yield.predictedWeekly.toFixed(1)}
                    unit={UNIT_LABELS.weeklyYield}
                    tone={READINESS_METRIC_TONE[readiness.tone]}
                    trend={readiness.tone === 'success' ? 'up' : 'stable'}
                    trendLabel={readiness.label}
                    detail={readiness.lead}
                />
                <MetricCard
                    icon={Droplets}
                    label={copy.transpiration}
                    value={formatMetricValue(currentData.transpiration)}
                    unit={UNIT_LABELS.transpirationRate}
                    tone="stable"
                    trend="stable"
                    trendLabel={copy.canopyActivity}
                />
            </div>
        </div>
    );
};

export default CropDetails;
