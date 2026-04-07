import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AlertTriangle, TestTubeDiagonal } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import type {
    AdvancedModelMetrics,
    CropType,
    ForecastData,
    ProducePricesPayload,
    RtrProfile,
    SensorData,
    WeatherOutlook,
} from '../../types';
import type { SmartGrowKnowledgeSummary } from '../../hooks/useSmartGrowKnowledge';
import {
    useSmartGrowAdvisor,
    type NutrientCorrectionPayload,
    type NutrientRecommendationPayload,
    type PesticideRecommendationPayload,
    type PlannedAdvisorTabKey,
} from '../../hooks/useSmartGrowAdvisor';
import {
    getCultivationMediumLabel,
    getCropLabel,
    getDevelopmentStageLabel,
    getGenericCropLabel,
    getLocalizedTokenLabel,
} from '../../utils/displayCopy';
import { buildAiDashboardContext } from '../../utils/aiDashboardContext';
import AdvisorActionCard from './AdvisorActionCard';
import {
    ADVISOR_TAB_REGISTRY,
    type PromptAdvisorTabKey,
} from './advisorTabRegistry';
import EnvironmentTab from './EnvironmentTab';
import HarvestMarketTab from './HarvestMarketTab';
import PhysiologyTab from './PhysiologyTab';
import WorkTab from './WorkTab';

interface AdvisorTabsProps {
    crop: CropType;
    summary?: SmartGrowKnowledgeSummary | null;
    currentData: SensorData;
    metrics: AdvancedModelMetrics;
    history?: SensorData[];
    forecast?: ForecastData | null;
    producePrices?: ProducePricesPayload | null;
    weather?: WeatherOutlook | null;
    rtrProfile?: RtrProfile | null;
    isOpen: boolean;
    onClose: () => void;
}

function formatNumber(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '-';
    }
    return value.toFixed(digits);
}

function compactLabel(value: string): string {
    return value.replace(/_/g, ' ');
}

function setAnalyteValue(
    setter: Dispatch<SetStateAction<Record<string, string>>>,
    key: string,
    value: string,
) {
    setter((current) => ({ ...current, [key]: value }));
}

const AdvisorTabs = ({
    crop,
    summary = null,
    currentData,
    metrics,
    history = [],
    forecast = null,
    producePrices = null,
    weather = null,
    rtrProfile = null,
    isOpen,
    onClose,
}: AdvisorTabsProps) => {
    const { locale } = useLocale();
    const cropKey = crop.toLowerCase();
    const cropLabel = getCropLabel(crop, locale);
    const formatStageLabel = (stage: string) => getDevelopmentStageLabel(stage, locale);
    const formatMediumLabel = (medium: string) => getCultivationMediumLabel(medium, locale);
    const formatCropName = (name: string) => getGenericCropLabel(name, locale);
    const copy = locale === 'ko'
        ? {
            title: '어드바이저 탭',
            subtitle: `${cropLabel} 기준으로 지금 필요한 실행안을 확인합니다.`,
            close: '닫기',
            environment: '환경제어',
            physiology: '재배생리',
            work: '재배작업',
            pesticide: '병해충 / 농약',
            nutrient: '양액 레시피',
            harvestMarket: '수확 / 가격',
            correctionTool: '양액 보정 툴',
            correctionHint: '원수·배액 입력이 있을 때만 다음 처방 보정 draft를 계산합니다.',
            showCorrectionTool: '보정 도구 열기',
            hideCorrectionTool: '보정 도구 닫기',
            run: '실행',
            running: '실행 중...',
            empty: '이 탭은 아직 실행하지 않았습니다.',
            error: '실행 실패',
            target: '병해충/병명',
            limit: '후보 수',
            stage: '생육 단계',
            medium: '배지',
            sourceWater: '원수 mmol/L',
            drainWater: '배액 mmol/L',
            workingSolution: '작업액 L',
            stockRatio: '원액 비율',
            limitations: '제약',
            matchedTargets: '매칭 타겟',
            rotation: '교호 대안',
            recipe: '선택된 처방',
            ecTarget: 'EC 목표',
            guardrails: '경계 조건',
            baselines: '기준값',
            findings: '우선 확인',
            missingData: '추가 데이터 필요',
            candidateDrafts: '보정 draft',
            macroBundle: '매크로 번들',
            unsupported: '수동 계산 필요',
            calculationAvailable: '계산 가능',
            recommendationAvailable: '추천 가능',
            noSafeRecommendation: '안전 추천 없음',
            loadingState: '로딩 중',
            estimatedBatchMass: '추정 투입량',
            dilution: '희석배수',
            application: '살포 방법',
            mixing: '혼용 주의',
            moaMissing: 'MOA 미상',
            calculationPolicy: '계산 정책',
            workingSolutionShort: '작업액',
            targetMode: '목표 모드',
            workbookDrainStage: '워크북 배액 단계',
            drainClGuardrail: '배액 Cl 경계값',
            boundedStepCap: '보정 단계 상한',
            targetPolicy: '목표 정책',
            baselineReference: '기준 대비',
            adjustmentStep: '조정량',
            stepCap: '상한',
            perTank: '탱크당',
            sourceWaterReview: '원수 검토',
            drainWaterReview: '배액 검토',
            drainFeedbackPlan: '배액 피드백 계획',
            bundleExecution: '번들 실행안',
            residualSafeAlternative: '잔여 안전 대안',
            rankLabel: '순위',
            tankLabel: '탱크',
            totalBatch: '총 배치량',
            stockConcentration: '원액 농도',
            selectedRank: '선택 순위',
            selectedBundleAboveTarget: '선택 번들의 과다 항목',
            unresolvedTargets: '미해결 목표',
            untargetedAdditions: '비목표 추가분',
            recipeTarget: '처방 목표',
            effectiveTarget: '적용 목표',
            sourceWaterStatus: '원수 상태',
            drainWaterStatus: '배액 상태',
            operationalStatusUnknown: '상태 미상',
            tankUnknown: '탱크 미정',
            labelCheckRequired: '라벨 확인 필요',
            adjustedCount: '조정',
            manualReviewCount: '수동 검토',
            noResiduals: '없음',
            clamped: '상한 적용',
        }
        : {
            title: 'Advisor Tabs',
            subtitle: `Run deterministic advisory flows for ${cropLabel}.`,
            close: 'Close',
            environment: 'Environment',
            physiology: 'Physiology',
            work: 'Work',
            pesticide: 'Pesticide',
            nutrient: 'Nutrient',
            harvestMarket: 'Harvest & Market',
            correctionTool: 'Nutrient correction tool',
            correctionHint: 'Run the draft correction flow only when source/drain inputs are available.',
            showCorrectionTool: 'Open correction tool',
            hideCorrectionTool: 'Hide correction tool',
            run: 'Run',
            running: 'Running...',
            empty: 'This tab has not been executed yet.',
            error: 'Execution failed',
            target: 'Target',
            limit: 'Limit',
            stage: 'Stage',
            medium: 'Medium',
            sourceWater: 'Source water mmol/L',
            drainWater: 'Drain water mmol/L',
            workingSolution: 'Working solution L',
            stockRatio: 'Stock ratio',
            limitations: 'Boundary',
            matchedTargets: 'Matched targets',
            rotation: 'Rotation alternatives',
            recipe: 'Selected recipe',
            guardrails: 'Guardrail',
            baselines: 'Baseline',
            findings: 'Priority findings',
            missingData: 'Missing data',
            candidateDrafts: 'Draft candidates',
            macroBundle: 'Macro bundle',
            unsupported: 'Manual calculation required',
            calculationAvailable: 'calculation available',
            recommendationAvailable: 'recommendation available',
            noSafeRecommendation: 'no safe recommendation',
            loadingState: 'loading',
            estimatedBatchMass: 'Estimated batch mass',
            dilution: 'Dilution',
            application: 'Application',
            mixing: 'Mixing',
            moaMissing: 'MOA n/a',
            calculationPolicy: 'Calculation policy',
            workingSolutionShort: 'working solution',
            targetMode: 'target mode',
            workbookDrainStage: 'workbook drain stage',
            drainClGuardrail: 'drain Cl guardrail',
            boundedStepCap: 'bounded step cap',
            sourceWaterReview: 'Source-water review',
            drainWaterReview: 'Drain-water review',
            drainFeedbackPlan: 'Drain-feedback plan',
            bundleExecution: 'Bundle execution',
            residualSafeAlternative: 'Residual-safe alternative',
            rankLabel: 'rank',
            tankLabel: 'Tank',
            totalBatch: 'total batch',
            stockConcentration: 'stock concentration',
            selectedRank: 'selected rank',
            selectedBundleAboveTarget: 'selected bundle above target',
            unresolvedTargets: 'unresolved targets',
            untargetedAdditions: 'untargeted additions',
            recipeTarget: 'recipe target',
            effectiveTarget: 'effective target',
            sourceWaterStatus: 'Source-water status',
            drainWaterStatus: 'Drain-water status',
            operationalStatusUnknown: 'n/a',
            tankUnknown: 'tank:n/a',
            labelCheckRequired: 'label-check-required',
            adjustedCount: 'adjusted',
            manualReviewCount: 'manual review',
            noResiduals: 'none',
            clamped: 'clamped',
        };

    const pesticideSurface = summary?.surfaces.find((surface) => surface.key === 'pesticide') ?? null;
    const nutrientSurface = summary?.surfaces.find((surface) => surface.key === 'nutrient') ?? null;
    const correctionSurface = summary?.surfaces.find((surface) => surface.key === 'nutrient_correction') ?? null;

    const defaultStage = correctionSurface?.stages[0] ?? nutrientSurface?.stages[0] ?? '';
    const defaultMedium = correctionSurface?.mediums[0] ?? nutrientSurface?.mediums[0] ?? '';
    const sourceAnalytes = correctionSurface?.sourceWaterAnalytes ?? [];
    const drainAnalytes = correctionSurface?.drainWaterAnalytes ?? [];

    const [activeTab, setActiveTab] = useState<PromptAdvisorTabKey>('environment');
    const [showCorrectionTool, setShowCorrectionTool] = useState(false);
    const [pesticideTarget, setPesticideTarget] = useState('흰가루병');
    const [pesticideLimit, setPesticideLimit] = useState('5');
    const [nutrientStage, setNutrientStage] = useState('');
    const [nutrientMedium, setNutrientMedium] = useState('');
    const [correctionStage, setCorrectionStage] = useState('');
    const [correctionMedium, setCorrectionMedium] = useState('');
    const [workingSolutionVolumeL, setWorkingSolutionVolumeL] = useState('');
    const [stockRatio, setStockRatio] = useState('');
    const [sourceWaterValues, setSourceWaterValues] = useState<Record<string, string>>({});
    const [drainWaterValues, setDrainWaterValues] = useState<Record<string, string>>({});
    const sectionRef = useRef<HTMLElement | null>(null);
    const advisorDashboard = useMemo(
        () =>
            buildAiDashboardContext({
                currentData,
                metrics,
                crop,
                history,
                forecast,
                producePrices,
                weather,
                rtrProfile,
            }),
        [crop, currentData, forecast, history, metrics, producePrices, rtrProfile, weather],
    );

    const {
        executionState,
        pesticideResult,
        nutrientResult,
        correctionResult,
        plannedTabResults,
        runPesticide,
        runNutrient,
        runCorrection,
        runPlannedTab,
    } = useSmartGrowAdvisor(cropKey);

    const effectiveNutrientStage = nutrientStage || defaultStage;
    const effectiveNutrientMedium = nutrientMedium || defaultMedium;
    const effectiveCorrectionStage = correctionStage || defaultStage;
    const effectiveCorrectionMedium = correctionMedium || defaultMedium;

    const tabLabels: Record<PromptAdvisorTabKey, string> = {
        environment: copy.environment,
        physiology: copy.physiology,
        work: copy.work,
        pesticide: copy.pesticide,
        nutrient: copy.nutrient,
        harvest_market: copy.harvestMarket,
    };

    const correctionCandidateCards = (() => {
        if (!correctionResult) {
            return [];
        }

        return Object.entries(
            correctionResult.correction_outputs.stock_tank_prep.candidate_fertilizers,
        ).flatMap(([key, candidates]) =>
            candidates.slice(0, 1).map((candidate) => ({
                key: `${key}-${candidate.fertilizer_name}`,
                title: `${candidate.target_analyte}: ${candidate.fertilizer_name}`,
                subtitle: candidate.formula ?? null,
                badges: [
                    getLocalizedTokenLabel(candidate.operational_status ?? copy.operationalStatusUnknown, locale),
                    candidate.tank_assignment ?? copy.tankUnknown,
                    ...(candidate.guardrail_side_effects.length > 0
                        ? [candidate.guardrail_side_effects.join(', ')]
                        : []),
                    ...(candidate.secondary_target_overshoots && candidate.secondary_target_overshoots.length > 0
                        ? [
                            candidate.secondary_target_overshoots
                                .map((row) => `${row.analyte} ${getLocalizedTokenLabel('high', locale)}`)
                                .join(', '),
                        ]
                        : []),
                ],
                grams:
                    candidate.single_fertilizer_draft?.estimated_batch_mass?.fertilizer_grams ?? null,
            })),
        );
    })();

    async function handlePlannedTabRun(tab: PlannedAdvisorTabKey) {
        try {
            await runPlannedTab(tab, advisorDashboard);
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
            // state is already captured in the hook
        }
    }

    async function handlePesticideRun() {
        try {
            await runPesticide(pesticideTarget, Number(pesticideLimit) || 5);
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
            // state is already captured in the hook
        }
    }

    async function handleNutrientRun() {
        try {
            await runNutrient(effectiveNutrientStage, effectiveNutrientMedium);
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
            // state is already captured in the hook
        }
    }

    async function handleCorrectionRun() {
        try {
            await runCorrection({
                stage: effectiveCorrectionStage,
                medium: effectiveCorrectionMedium,
                sourceWater: sourceWaterValues,
                drainWater: drainWaterValues,
                workingSolutionVolumeL,
                stockRatio,
            });
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
            // state is already captured in the hook
        }
    }

    function renderPesticideResult(result: PesticideRecommendationPayload | null) {
        const state = executionState.pesticide;
        if (state.status === 'error') {
            return (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                    {copy.error}: {state.error}
                </div>
            );
        }
        if (!result) {
            return <div className="text-sm text-slate-500">{copy.empty}</div>;
        }

        const hasRecommendations = result.product_recommendations.length > 0;
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                        {hasRecommendations ? copy.recommendationAvailable : copy.noSafeRecommendation}
                    </span>
                    {result.matched_targets.map((target) => (
                        <span
                            key={target}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                        >
                            {target}
                        </span>
                    ))}
                </div>
                {result.product_recommendations.map((product) => (
                    <AdvisorActionCard
                        key={product.product_name}
                        title={product.product_name}
                        subtitle={product.notes_farmer_friendly}
                        badges={[
                            product.active_ingredient,
                            product.moa_code_group ?? copy.moaMissing,
                            getLocalizedTokenLabel(product.registration_status ?? copy.labelCheckRequired, locale),
                        ]}
                    >
                        <div className="grid gap-2 text-sm text-slate-600 lg:grid-cols-2">
                            <div>{copy.matchedTargets}: {result.matched_targets.join(', ') || '-'}</div>
                            <div>{copy.limitations}: {product.cycle_recommendation ?? '-'}</div>
                            <div>{copy.dilution}: {product.dilution ?? '-'}</div>
                            <div>{copy.application}: {product.application_method ?? '-'}</div>
                            <div className="lg:col-span-2">{copy.mixing}: {product.mixing_caution ?? '-'}</div>
                        </div>
                    </AdvisorActionCard>
                ))}
                {result.rotation_program.length > 0 ? (
                    <AdvisorActionCard
                    title={copy.rotation}
                    badges={result.rotation_program.map((row) => row.moa_code_group ?? 'MOA')}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            {result.rotation_program.map((row) => (
                                <div key={`${row.rotation_slot}-${row.product_name}`}>
                                    {row.rotation_slot ?? '-'}: {row.product_name} ({row.active_ingredient})
                                </div>
                            ))}
                        </div>
                    </AdvisorActionCard>
                ) : null}
                <p className="text-sm leading-relaxed text-slate-500">
                    {result.limitations.join(' ')}
                </p>
            </div>
        );
    }

    function renderNutrientResult(result: NutrientRecommendationPayload | null) {
        const state = executionState.nutrient;
        if (state.status === 'error') {
            return (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                    {copy.error}: {state.error}
                </div>
            );
        }
        if (!result) {
            return <div className="text-sm text-slate-500">{copy.empty}</div>;
        }

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                        {copy.calculationAvailable}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        {formatStageLabel(result.resolved.stage)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        {formatMediumLabel(result.resolved.medium)}
                    </span>
                </div>
                <AdvisorActionCard
                    title={copy.recipe}
                    subtitle={`${formatCropName(result.recipe.crop)} · ${formatStageLabel(result.recipe.stage)} · ${formatMediumLabel(result.recipe.medium)}`}
                >
                    <div className="grid gap-2 text-sm text-slate-600 lg:grid-cols-2">
                        <div>{copy.ecTarget}: {formatNumber(result.recipe.ec_target)}</div>
                        <div>
                            {copy.guardrails}: Cl {formatNumber(result.recipe.guardrails.cl_max)},
                            {' '}HCO3 {formatNumber(result.recipe.guardrails.hco3_max)},
                            {' '}Na {formatNumber(result.recipe.guardrails.na_max)}
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(result.recipe.nutrient_targets).map(([key, value]) => (
                            <span
                                key={key}
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                            >
                                {compactLabel(key)} {formatNumber(value)}
                            </span>
                        ))}
                    </div>
                </AdvisorActionCard>
                <AdvisorActionCard
                    title={copy.baselines}
                    badges={result.fertilizer_catalog.slice(0, 4).map((row) => row.fertilizer_name)}
                >
                    <div className="grid gap-3 text-sm text-slate-600 lg:grid-cols-2">
                        <div>
                            {copy.sourceWater}: {result.source_water_baseline.slice(0, 6).map((row) => `${row.analyte} ${formatNumber(row.mmol_l)}`).join(', ') || '-'}
                        </div>
                        <div>
                            {copy.drainWater}: {result.drain_water_baseline.slice(0, 6).map((row) => `${row.analyte} ${formatNumber(row.mmol_l)}`).join(', ') || '-'}
                        </div>
                    </div>
                </AdvisorActionCard>
                <p className="text-sm leading-relaxed text-slate-500">
                    {result.limitations.join(' ')}
                </p>
            </div>
        );
    }

    function renderCorrectionResult(result: NutrientCorrectionPayload | null) {
        const state = executionState.correction;
        if (state.status === 'error') {
            return (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                    {copy.error}: {state.error}
                </div>
            );
        }
        if (!result) {
            return <div className="text-sm text-slate-500">{copy.empty}</div>;
        }

        const missingData = result.correction_outputs.required_manual_inputs;
        const sourceReview = result.correction_outputs.source_water_review;
        const drainReview = result.correction_outputs.drain_water_review;
        const drainPlan = result.correction_outputs.drain_feedback_plan;
        const bundle = result.correction_outputs.stock_tank_prep.macro_bundle_candidates[0] ?? null;
        const residualAlternative = result.correction_outputs.stock_tank_prep.residual_safe_alternative;
        const bundleExecution = result.correction_outputs.stock_tank_prep.macro_bundle_execution;
        const drainClGuardrail = result.correction_context.drain_feedback_defaults
            .cl_guardrail_mmol_l;

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                        {copy.calculationAvailable}
                    </span>
                    {missingData.length > 0 ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                            {copy.missingData}
                        </span>
                    ) : null}
                </div>
                {result.correction_outputs.priority_findings.length > 0 ? (
                    <AdvisorActionCard
                        title={copy.findings}
                        badges={result.correction_outputs.priority_findings.map((row) => row.status)}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            {result.correction_outputs.priority_findings.map((finding) => (
                                <div key={`${finding.analysis_kind}-${finding.analyte ?? finding.nutrient}`}>
                                    {finding.analyte ?? finding.nutrient}: {getLocalizedTokenLabel(finding.status, locale)} ({formatNumber(finding.observed_mmol_l ?? finding.submitted_mmol_l)} / {copy.baselineReference} {formatNumber(finding.baseline_mmol_l)})
                                </div>
                            ))}
                        </div>
                    </AdvisorActionCard>
                ) : null}
                {missingData.length > 0 ? (
                    <AdvisorActionCard
                        title={copy.missingData}
                        subtitle={missingData.join(', ')}
                    />
                ) : null}
                    <AdvisorActionCard
                        title={copy.calculationPolicy}
                        subtitle={`${formatStageLabel(result.resolved.stage)} | ${formatMediumLabel(result.resolved.medium)}`}
                        badges={[
                        `${copy.workingSolutionShort} ${formatNumber(result.correction_context.calculator_defaults.working_solution_volume_l)}`,
                        `${copy.stockRatio} ${formatNumber(result.correction_context.calculator_defaults.stock_ratio)}`,
                        `${copy.targetMode} ${getLocalizedTokenLabel(result.correction_context.drain_feedback_policy.mode, locale)}`,
                        ]}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            <div>
                            {copy.workbookDrainStage}: {result.correction_context.drain_feedback_defaults.selected_stage ? formatStageLabel(String(result.correction_context.drain_feedback_defaults.selected_stage)) : '-'}
                        </div>
                        <div>
                            {copy.drainClGuardrail}: {formatNumber(
                                typeof drainClGuardrail === 'number' ? drainClGuardrail : null,
                            )}
                        </div>
                        <div>
                            {copy.boundedStepCap}: min(
                            {formatNumber(result.correction_context.drain_feedback_policy.step_cap_max_mmol_l, 3)},
                            max(
                            {formatNumber(result.correction_context.drain_feedback_policy.step_cap_min_mmol_l, 3)},
                            {copy.recipeTarget} x {formatNumber(result.correction_context.drain_feedback_policy.step_cap_ratio, 2)}
                            ))
                        </div>
                    </div>
                </AdvisorActionCard>
                {sourceReview.length > 0 ? (
                    <AdvisorActionCard
                        title={copy.sourceWaterReview}
                        badges={sourceReview.map((row) => getLocalizedTokenLabel(row.status, locale))}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            {sourceReview.map((row) => (
                                <div key={`source-${row.analyte}`}>
                                    {row.analyte}: {getLocalizedTokenLabel(row.status, locale)} ({formatNumber(row.observed_mmol_l)} / {copy.baselineReference} {formatNumber(row.baseline_mmol_l)})
                                </div>
                            ))}
                        </div>
                    </AdvisorActionCard>
                ) : null}
                {drainReview.length > 0 ? (
                    <AdvisorActionCard
                        title={copy.drainWaterReview}
                        badges={drainReview.map((row) => getLocalizedTokenLabel(row.status, locale))}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            {drainReview.map((row) => (
                                <div key={`drain-${row.analyte}`}>
                                    {row.analyte}: {getLocalizedTokenLabel(row.status, locale)} ({formatNumber(row.observed_mmol_l)} / {copy.baselineReference} {formatNumber(row.baseline_mmol_l)})
                                </div>
                            ))}
                        </div>
                    </AdvisorActionCard>
                ) : null}
                {drainPlan.adjustments.length > 0 ? (
                    <AdvisorActionCard
                        title={copy.drainFeedbackPlan}
                        subtitle={getLocalizedTokenLabel(drainPlan.mode, locale)}
                        badges={[
                            `${drainPlan.adjusted_analytes.length} ${copy.adjustedCount}`,
                            `${drainPlan.manual_review_analytes.length} ${copy.manualReviewCount}`,
                        ]}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            {drainPlan.adjustments.map((row) => (
                                <div
                                    key={`drain-plan-${row.canonical_key}`}
                                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                                >
                                    <div className="font-medium text-slate-900">
                                        {row.analyte}: {getLocalizedTokenLabel(row.status, locale)}
                                    </div>
                                    <div className="mt-1">
                                        {copy.recipeTarget} {formatNumber(row.recipe_target_mmol_l, 4)} → {copy.effectiveTarget} {formatNumber(row.effective_target_mmol_l, 4)}
                                    </div>
                                    <div className="mt-1">
                                        {copy.drainWater} {formatNumber(row.observed_drain_mmol_l, 4)} / {copy.baselineReference} {formatNumber(row.baseline_drain_mmol_l, 4)} | {copy.adjustmentStep} {formatNumber(row.applied_step_mmol_l, 4)}
                                        {row.step_cap_mmol_l !== null ? ` / ${copy.stepCap} ${formatNumber(row.step_cap_mmol_l, 4)}` : ''}
                                        {row.clamped ? ` | ${copy.clamped}` : ''}
                                    </div>
                                    <div className="mt-1">{row.rationale}</div>
                                </div>
                            ))}
                        </div>
                    </AdvisorActionCard>
                ) : null}
                <AdvisorActionCard
                    title={copy.candidateDrafts}
                    subtitle={`${formatStageLabel(result.resolved.stage)} · ${formatMediumLabel(result.resolved.medium)}`}
                    badges={[
                        ...result.correction_outputs.stock_tank_prep.balance_basis.draft_eligible_analytes,
                        `${copy.targetPolicy} ${getLocalizedTokenLabel(result.correction_outputs.stock_tank_prep.balance_basis.target_policy.mode, locale)}`,
                    ]}
                >
                    <div className="space-y-3">
                        {correctionCandidateCards.map((candidate) => (
                            <div
                                key={candidate.key}
                                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-600"
                            >
                                <div className="font-medium text-slate-900">{candidate.title}</div>
                                <div className="mt-1">{candidate.subtitle ?? '-'}</div>
                                <div className="mt-1">{candidate.badges.join(' | ')}</div>
                                <div className="mt-1">
                                    {copy.estimatedBatchMass}: {formatNumber(candidate.grams, 4)} g
                                </div>
                            </div>
                        ))}
                    </div>
                </AdvisorActionCard>
                {bundle ? (
                    <AdvisorActionCard
                        title={copy.macroBundle}
                        subtitle={bundle.disclaimer}
                        badges={[`${copy.rankLabel} ${bundle.rank}`, getLocalizedTokenLabel(bundle.mode, locale), getLocalizedTokenLabel(bundle.status, locale)]}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            {bundle.selected_fertilizers.map((row) => (
                                <div key={`${row.lane_analyte}-${row.fertilizer_name}`}>
                                    {row.lane_analyte}: {row.fertilizer_name} ({formatNumber(row.estimated_batch_mass.fertilizer_grams, 4)} g)
                                </div>
                            ))}
                            {bundle.provisional_reasons.length > 0 ? (
                                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-amber-800">
                                    {bundle.provisional_reasons.join(' ')}
                                </div>
                            ) : null}
                        </div>
                    </AdvisorActionCard>
                ) : null}
                <AdvisorActionCard
                    title={copy.bundleExecution}
                    subtitle={bundleExecution.disclaimer}
                    badges={[
                        getLocalizedTokenLabel(bundleExecution.status, locale),
                        `${copy.rankLabel} ${bundleExecution.selected_bundle_rank ?? copy.operationalStatusUnknown}`,
                    ]}
                >
                        <div className="space-y-3 text-sm text-slate-600">
                            <div>
                                {copy.stockConcentration} {copy.perTank}: {formatNumber(bundleExecution.stock_solution_volume_l_per_tank, 4)} L
                            </div>
                        {bundleExecution.tank_plan.map((tank) => (
                            <div
                                key={tank.tank_assignment}
                                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                            >
                                <div className="font-medium text-slate-900">{copy.tankLabel} {tank.tank_assignment}</div>
                                <div className="mt-1">
                                    {copy.totalBatch}: {formatNumber(tank.total_batch_mass_g, 4)} g
                                </div>
                                <div className="mt-1">
                                    {copy.stockConcentration}: {formatNumber(tank.stock_solution_concentration_g_l, 4)} g/L
                                </div>
                                <div className="mt-2 space-y-1">
                                    {tank.fertilizer_lines.map((line) => (
                                        <div key={`${tank.tank_assignment}-${line.lane_analyte}-${line.fertilizer_name}`}>
                                            {line.lane_analyte}: {line.fertilizer_name} ({formatNumber(line.batch_mass_g, 4)} g)
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {bundleExecution.readiness_reasons.length > 0 ? (
                            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-amber-800">
                                {bundleExecution.readiness_reasons.join(' ')}
                            </div>
                        ) : null}
                    </div>
                </AdvisorActionCard>
                <AdvisorActionCard
                    title={copy.residualSafeAlternative}
                    subtitle={residualAlternative.guidance}
                    badges={[
                        residualAlternative.policy,
                        getLocalizedTokenLabel(residualAlternative.status, locale),
                        `${copy.selectedRank} ${residualAlternative.selected_bundle_rank ?? copy.operationalStatusUnknown}`,
                    ]}
                >
                    <div className="space-y-3 text-sm text-slate-600">
                        {residualAlternative.selected_bundle_over_target_analytes.length > 0 ? (
                            <div>
                                {copy.selectedBundleAboveTarget}: {residualAlternative.selected_bundle_over_target_analytes.join(', ')}
                            </div>
                        ) : null}
                        {residualAlternative.recommended_bundle ? (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                                <div className="font-medium text-slate-900">
                                    {copy.rankLabel} {residualAlternative.recommended_bundle.rank} | {getLocalizedTokenLabel(residualAlternative.recommended_bundle.status, locale)}
                                </div>
                                <div className="mt-1">
                                    {copy.unresolvedTargets}:{' '}
                                    {residualAlternative.recommended_bundle.residual_review.unresolved_targets.length > 0
                                        ? residualAlternative.recommended_bundle.residual_review.unresolved_targets
                                            .map((row) => `${row.analyte} ${formatNumber(row.residual_mmol_l, 4)} (${row.status})`)
                                            .join(' | ')
                                        : copy.noResiduals}
                                </div>
                                <div className="mt-1">
                                    {copy.untargetedAdditions}:{' '}
                                    {residualAlternative.recommended_bundle.residual_review.untargeted_additions.length > 0
                                        ? residualAlternative.recommended_bundle.residual_review.untargeted_additions
                                            .map((row) => `${row.analyte} ${formatNumber(row.projected_mmol_l, 4)}`)
                                            .join(' | ')
                                        : copy.noResiduals}
                                </div>
                                <div className="mt-2 space-y-1">
                                    {residualAlternative.recommended_bundle.selected_fertilizers.map((row) => (
                                        <div key={`residual-alt-${row.lane_analyte}-${row.fertilizer_name}`}>
                                            {row.lane_analyte}: {row.fertilizer_name}
                                        </div>
                                    ))}
                                </div>
                                {residualAlternative.recommended_bundle.provisional_reasons.length > 0 ? (
                                    <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-amber-800">
                                        {residualAlternative.recommended_bundle.provisional_reasons.join(' ')}
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div>{residualAlternative.guidance}</div>
                        )}
                    </div>
                </AdvisorActionCard>
                {result.correction_outputs.stock_tank_prep.unsupported_analytes.length > 0 ? (
                    <AdvisorActionCard
                        title={copy.unsupported}
                        badges={result.correction_outputs.stock_tank_prep.unsupported_analytes.map((row) => row.nutrient)}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            {result.correction_outputs.stock_tank_prep.unsupported_analytes.map((row) => (
                                <div key={row.nutrient}>{row.reason}</div>
                            ))}
                        </div>
                    </AdvisorActionCard>
                ) : null}
                <p className="text-sm leading-relaxed text-slate-500">
                    {result.limitations.join(' ')}
                </p>
            </div>
        );
    }

    function renderPendingTab(tab: PlannedAdvisorTabKey) {
        const state = executionState[tab];
        const sharedProps = {
            status: state.status,
            error: state.error,
            result: plannedTabResults[tab],
            onRun: () => void handlePlannedTabRun(tab),
        };

        switch (tab) {
            case 'environment':
                return <EnvironmentTab {...sharedProps} />;
            case 'physiology':
                return <PhysiologyTab {...sharedProps} />;
            case 'work':
                return <WorkTab {...sharedProps} />;
            case 'harvest_market':
                return <HarvestMarketTab {...sharedProps} />;
            default:
                return null;
        }
    }

    if (!isOpen) {
        return null;
    }

    const activeTabEntry =
        ADVISOR_TAB_REGISTRY.find((entry) => entry.key === activeTab) ?? ADVISOR_TAB_REGISTRY[0];
    const ActiveIcon = activeTabEntry.icon;

    return (
        <section
            ref={sectionRef}
            className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
                        {copy.title}
                    </div>
                    <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
                        <ActiveIcon className="h-5 w-5 text-indigo-600" />
                        {cropLabel}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                    {copy.close}
                </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
                {ADVISOR_TAB_REGISTRY.map((tab) => {
                    const Icon = tab.icon;
                    const state = executionState[tab.key];
                    const isActive = tab.key === activeTab;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => {
                                setActiveTab(tab.key);
                                if (tab.key !== 'nutrient') {
                                    setShowCorrectionTool(false);
                                }
                            }}
                            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            <span className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {tabLabels[tab.key]}
                                {state.status === 'loading' ? (
                                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase">
                                        {copy.loadingState}
                                    </span>
                                ) : null}
                            </span>
                        </button>
                    );
                })}
            </div>

            {activeTabEntry.kind === 'pending' ? (
                <div className="mt-6">
                    {renderPendingTab(activeTab as PlannedAdvisorTabKey)}
                </div>
            ) : (
                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)]">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                        {activeTab === 'pesticide' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        {copy.target}
                                    </label>
                                    <input
                                        value={pesticideTarget}
                                        onChange={(event) => setPesticideTarget(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        {copy.limit}
                                    </label>
                                    <input
                                        value={pesticideLimit}
                                        onChange={(event) => setPesticideLimit(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-emerald-400"
                                    />
                                </div>
                                {pesticideSurface?.limitation ? (
                                    <p className="text-sm leading-relaxed text-slate-500">
                                        {pesticideSurface.limitation}
                                    </p>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => void handlePesticideRun()}
                                    disabled={executionState.pesticide.status === 'loading'}
                                    className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                                >
                                    {executionState.pesticide.status === 'loading' ? copy.running : copy.run}
                                </button>
                            </div>
                        ) : null}

                        {activeTab === 'nutrient' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        {copy.stage}
                                    </label>
                                    <select
                                        value={effectiveNutrientStage}
                                        onChange={(event) => setNutrientStage(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-sky-400"
                                    >
                                        {(nutrientSurface?.stages ?? []).map((stage) => (
                                            <option key={stage} value={stage}>{formatStageLabel(stage)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        {copy.medium}
                                    </label>
                                    <select
                                        value={effectiveNutrientMedium}
                                        onChange={(event) => setNutrientMedium(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-sky-400"
                                    >
                                        {(nutrientSurface?.mediums ?? []).map((medium) => (
                                            <option key={medium} value={medium}>{formatMediumLabel(medium)}</option>
                                        ))}
                                    </select>
                                </div>
                                {nutrientSurface?.limitation ? (
                                    <p className="text-sm leading-relaxed text-slate-500">
                                        {nutrientSurface.limitation}
                                    </p>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => void handleNutrientRun()}
                                    disabled={executionState.nutrient.status === 'loading'}
                                    className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
                                >
                                    {executionState.nutrient.status === 'loading' ? copy.running : copy.run}
                                </button>

                                <div className="rounded-2xl border border-violet-100 bg-white p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                                <TestTubeDiagonal className="h-4 w-4 text-violet-600" />
                                                {copy.correctionTool}
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                                {copy.correctionHint}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowCorrectionTool((current) => !current)}
                                            className="rounded-full border border-violet-200 px-3 py-1.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
                                        >
                                            {showCorrectionTool ? copy.hideCorrectionTool : copy.showCorrectionTool}
                                        </button>
                                    </div>

                                    {showCorrectionTool ? (
                                        <div className="mt-4 space-y-4 border-t border-violet-100 pt-4">
                                            <div className="grid gap-4 lg:grid-cols-2">
                                                <div>
                                                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                        {copy.stage}
                                                    </label>
                                                    <select
                                                        value={effectiveCorrectionStage}
                                                        onChange={(event) => setCorrectionStage(event.target.value)}
                                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-violet-400"
                                                    >
                                                        {(correctionSurface?.stages ?? []).map((stage) => (
                                                            <option key={stage} value={stage}>{formatStageLabel(stage)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                        {copy.medium}
                                                    </label>
                                                    <select
                                                        value={effectiveCorrectionMedium}
                                                        onChange={(event) => setCorrectionMedium(event.target.value)}
                                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-violet-400"
                                                    >
                                                        {(correctionSurface?.mediums ?? []).map((medium) => (
                                                            <option key={medium} value={medium}>{formatMediumLabel(medium)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid gap-4 lg:grid-cols-2">
                                                <div>
                                                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                        {copy.workingSolution}
                                                    </label>
                                                    <input
                                                        value={workingSolutionVolumeL}
                                                        onChange={(event) => setWorkingSolutionVolumeL(event.target.value)}
                                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-violet-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                        {copy.stockRatio}
                                                    </label>
                                                    <input
                                                        value={stockRatio}
                                                        onChange={(event) => setStockRatio(event.target.value)}
                                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-violet-400"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    {copy.sourceWater}
                                                </div>
                                                <div className="mt-2 grid gap-2 lg:grid-cols-3">
                                                    {sourceAnalytes.map((analyte) => (
                                                        <label key={analyte} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                                            <div className="font-medium text-slate-700">{analyte}</div>
                                                            <input
                                                                value={sourceWaterValues[analyte] ?? ''}
                                                                onChange={(event) =>
                                                                    setAnalyteValue(setSourceWaterValues, analyte, event.target.value)
                                                                }
                                                                className="mt-2 w-full border-0 bg-transparent p-0 text-sm text-slate-700 outline-none"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    {copy.drainWater}
                                                </div>
                                                <div className="mt-2 grid gap-2 lg:grid-cols-3">
                                                    {drainAnalytes.map((analyte) => (
                                                        <label key={analyte} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                                            <div className="font-medium text-slate-700">{analyte}</div>
                                                            <input
                                                                value={drainWaterValues[analyte] ?? ''}
                                                                onChange={(event) =>
                                                                    setAnalyteValue(setDrainWaterValues, analyte, event.target.value)
                                                                }
                                                                className="mt-2 w-full border-0 bg-transparent p-0 text-sm text-slate-700 outline-none"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            {correctionSurface?.limitation ? (
                                                <p className="text-sm leading-relaxed text-slate-500">
                                                    {correctionSurface.limitation}
                                                </p>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => void handleCorrectionRun()}
                                                disabled={executionState.correction.status === 'loading'}
                                                className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
                                            >
                                                {executionState.correction.status === 'loading' ? copy.running : copy.run}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                        {activeTab === 'pesticide' ? renderPesticideResult(pesticideResult) : null}
                        {activeTab === 'nutrient' ? (
                            <div className="space-y-6">
                                {renderNutrientResult(nutrientResult)}
                                {showCorrectionTool ? renderCorrectionResult(correctionResult) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </section>
    );
};

export default AdvisorTabs;
