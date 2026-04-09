import type { PlannedAdvisorTabPayload } from '../../hooks/useSmartGrowAdvisor';
import { useLocale } from '../../i18n/LocaleProvider';
import { getDevelopmentStageLabel, getLocalizedTokenLabel } from '../../utils/displayCopy';
import AdvisorActionCard from './AdvisorActionCard';
import AdvisorConfidenceBadge from './AdvisorConfidenceBadge';
import AdvisorLandedTabStatePanel from './AdvisorLandedTabStatePanel';
import AdvisorModelRuntimePanel from './AdvisorModelRuntimePanel';

interface PhysiologyTabProps {
    status: 'idle' | 'loading' | 'success' | 'error';
    error: string | null;
    result?: PlannedAdvisorTabPayload;
    onRun: () => void;
}

const PhysiologyTab = (props: PhysiologyTabProps) => {
    const { locale } = useLocale();
    const analysis = props.result?.machine_payload.physiology_analysis;
    const modelRuntime = props.result?.machine_payload.model_runtime;
    const copy = locale === 'ko'
        ? {
            title: '재배생리',
            summary: '생리 요약',
            currentState: '현재 상태',
            supportingSignals: '지원 신호',
            actions: '다음 조치',
            checklist: '확인 체크리스트',
            context: '현재 문맥',
            urgency: '긴급도',
            confidence: '판단 안정도',
            diagnosis: '진단',
            balanceState: '균형 상태',
            deviation: '편차 / 설명',
            hypotheses: '원인 가설',
            cropContext: '작물 문맥',
            insideTemp: '실내 온도',
            insideHumidity: '실내 습도',
            canopyTemp: '캐노피 온도',
            canopyDelta: '캐노피-기온 차이',
            insideVpd: '실내 VPD',
            transpiration: '증산',
            stomatal: '기공전도도',
            photosynthesis: '광합성',
            insideCo2: '실내 CO2',
            insideLight: '실내 광량',
            lai: 'LAI',
            biomass: '생체중',
            growthRate: '성장률',
            developmentStage: '생육 단계',
            activeTrusses: '활성 화방',
            nodeCount: '마디 수',
            harvestableFruits: '수확 가능 과실',
            predictedWeeklyYield: '주간 수확 전망',
            tempTrend: '온도 추세',
            vpdTrend: 'VPD 추세',
            transpirationTrend: '증산 추세',
            photosynthesisTrend: '광합성 추세',
            availableButNotRun: '생리 어드바이저는 이미 적용되어 있으며, 실행하면 현재 생육 균형 해석을 확인할 수 있습니다.',
        }
        : {
            title: 'Physiology',
            summary: 'Physiology summary',
            currentState: 'Current state',
            supportingSignals: 'Supporting signals',
            actions: 'Follow-up actions',
            checklist: 'Monitoring checklist',
            context: 'Context snapshot',
            urgency: 'Urgency',
            confidence: 'Decision readiness',
            diagnosis: 'Diagnosis',
            balanceState: 'Balance state',
            deviation: 'Deviation / explanation',
            hypotheses: 'Cause hypotheses',
            cropContext: 'Crop context',
            insideTemp: 'Inside temp',
            insideHumidity: 'Inside humidity',
            canopyTemp: 'Canopy temp',
            canopyDelta: 'Canopy-Air Delta',
            insideVpd: 'Inside VPD',
            transpiration: 'Transpiration',
            stomatal: 'Stomatal conductance',
            photosynthesis: 'Photosynthesis',
            insideCo2: 'Inside CO2',
            insideLight: 'Inside light',
            lai: 'LAI',
            biomass: 'Biomass',
            growthRate: 'Growth rate',
            developmentStage: 'Development stage',
            activeTrusses: 'Active trusses',
            nodeCount: 'Node count',
            harvestableFruits: 'Harvestable fruits',
            predictedWeeklyYield: 'Predicted weekly yield',
            tempTrend: 'Temp trend',
            vpdTrend: 'VPD trend',
            transpirationTrend: 'Transpiration trend',
            photosynthesisTrend: 'Photosynthesis trend',
            availableButNotRun: 'The physiology advisor is already landed. Run it to inspect the current crop-balance interpretation.',
        };

    function formatValue(
        value: number | null | undefined,
        digits = 1,
        unit = '',
    ) {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return '-';
        }
        return `${value.toFixed(digits)}${unit}`;
    }

    if (props.status !== 'error' && analysis) {
        return (
            <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
                <div className="sg-advisor-shell sg-advisor-shell-green space-y-4">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                            {copy.title}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-[color:var(--sg-text-strong)]">{copy.summary}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--sg-text-muted)]">{analysis.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <AdvisorConfidenceBadge label={`${copy.urgency}:${getLocalizedTokenLabel(analysis.urgency, locale)}`} tone="warning" />
                        <AdvisorConfidenceBadge
                            label={`${copy.confidence}:${Math.round(analysis.confidence * 100)}%`}
                            tone="info"
                        />
                        {props.result?.machine_payload.missing_data.map((item) => (
                            <AdvisorConfidenceBadge
                                key={item}
                                label={getLocalizedTokenLabel(item, locale)}
                                tone="neutral"
                            />
                        ))}
                    </div>

                    <AdvisorActionCard title={copy.currentState} subtitle={copy.title}>
                        <div className="space-y-3 text-sm text-[color:var(--sg-text-muted)]">
                            <div>
                                <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.diagnosis}: </span>
                                {analysis.current_state.diagnosis}
                            </div>
                            <div>
                                <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.balanceState}: </span>
                                {getLocalizedTokenLabel(analysis.current_state.balance_state, locale)}
                            </div>
                            <div>
                                <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.deviation}: </span>
                                {analysis.current_state.deviation}
                            </div>
                            <div>
                                <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.cropContext}: </span>
                                {analysis.current_state.crop_specific_context}
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-[color:var(--sg-text-strong)]">{copy.hypotheses}</div>
                                <ul className="space-y-2">
                                    {analysis.current_state.cause_hypotheses.map((item) => (
                                        <li
                                            key={item}
                                            className="sg-advisor-note"
                                        >
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </AdvisorActionCard>

                    <AdvisorActionCard title={copy.context} subtitle={copy.title}>
                        <div className="grid gap-2 text-sm text-[color:var(--sg-text-muted)] sm:grid-cols-2">
                            <div>{copy.insideTemp}: {formatValue(analysis.context_snapshot.inside_temp_c, 1, ' °C')}</div>
                            <div>{copy.insideHumidity}: {formatValue(analysis.context_snapshot.inside_humidity_pct, 0, '%')}</div>
                            <div>{copy.canopyTemp}: {formatValue(analysis.context_snapshot.canopy_temp_c, 1, ' °C')}</div>
                            <div>{copy.canopyDelta}: {formatValue(analysis.context_snapshot.canopy_air_delta_c, 1, ' °C')}</div>
                            <div>{copy.insideVpd}: {formatValue(analysis.context_snapshot.inside_vpd_kpa, 2, ' kPa')}</div>
                            <div>{copy.transpiration}: {formatValue(analysis.context_snapshot.transpiration_mm_h, 2, ' mm h⁻¹')}</div>
                            <div>{copy.stomatal}: {formatValue(analysis.context_snapshot.stomatal_conductance_mol_m2_s, 2, ' mol m⁻² s⁻¹')}</div>
                            <div>{copy.photosynthesis}: {formatValue(analysis.context_snapshot.photosynthesis_umol_m2_s, 1, ' µmol m⁻² s⁻¹')}</div>
                            <div>{copy.insideCo2}: {formatValue(analysis.context_snapshot.inside_co2_ppm, 0, ' ppm')}</div>
                            <div>{copy.insideLight}: {formatValue(analysis.context_snapshot.inside_light_umol_m2_s, 0, ' µmol')}</div>
                            <div>{copy.lai}: {formatValue(analysis.context_snapshot.lai, 2)}</div>
                            <div>{copy.biomass}: {formatValue(analysis.context_snapshot.biomass_g_m2, 0, ' g m⁻²')}</div>
                            <div>{copy.growthRate}: {formatValue(analysis.context_snapshot.growth_rate_g_m2_d, 1, ' g m⁻² d⁻¹')}</div>
                            <div>
                                {copy.developmentStage}:{' '}
                                {analysis.context_snapshot.development_stage
                                    ? getDevelopmentStageLabel(analysis.context_snapshot.development_stage, locale)
                                    : '-'}
                            </div>
                            <div>{copy.activeTrusses}: {formatValue(analysis.context_snapshot.active_trusses, 0)}</div>
                            <div>{copy.nodeCount}: {formatValue(analysis.context_snapshot.node_count, 0)}</div>
                            <div>{copy.harvestableFruits}: {formatValue(analysis.context_snapshot.harvestable_fruits, 0)}</div>
                            <div>{copy.predictedWeeklyYield}: {formatValue(analysis.context_snapshot.predicted_weekly_yield_kg, 1, ' kg')}</div>
                            <div>{copy.tempTrend}: {getLocalizedTokenLabel(analysis.context_snapshot.temperature_trend ?? '-', locale)}</div>
                            <div>{copy.vpdTrend}: {getLocalizedTokenLabel(analysis.context_snapshot.vpd_trend ?? '-', locale)}</div>
                            <div>{copy.transpirationTrend}: {getLocalizedTokenLabel(analysis.context_snapshot.transpiration_trend ?? '-', locale)}</div>
                            <div>{copy.photosynthesisTrend}: {getLocalizedTokenLabel(analysis.context_snapshot.photosynthesis_trend ?? '-', locale)}</div>
                        </div>
                    </AdvisorActionCard>
                </div>

                <div className="space-y-4">
                    {modelRuntime !== undefined ? (
                        <AdvisorModelRuntimePanel runtime={modelRuntime} />
                    ) : null}
                    <div className="grid gap-4 xl:grid-cols-2">
                        <AdvisorActionCard title={copy.supportingSignals} subtitle={copy.title}>
                            <div className="space-y-3">
                                {analysis.supporting_signals.map((signal) => (
                                    <div
                                        key={`${signal.label}-${signal.value}`}
                                        className="sg-advisor-inset"
                                    >
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                            {signal.label}
                                        </div>
                                        <div className="mt-2 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                            {signal.value}
                                        </div>
                                        <div className="mt-2 text-sm leading-relaxed text-[color:var(--sg-text-muted)]">
                                            {signal.interpretation}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AdvisorActionCard>

                        <AdvisorActionCard title={copy.actions} subtitle={copy.title}>
                            <div className="space-y-3">
                                {analysis.follow_up_actions.map((action) => (
                                    <div
                                        key={`${action.time_window}-${action.title}`}
                                        className="sg-advisor-inset"
                                    >
                                        <div className="flex flex-wrap gap-2">
                                            <AdvisorConfidenceBadge label={getLocalizedTokenLabel(action.time_window, locale)} tone="success" />
                                        </div>
                                        <div className="mt-3 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                            {action.title}
                                        </div>
                                        <div className="mt-2 text-sm text-[color:var(--sg-text-muted)]">{action.rationale}</div>
                                        <div className="mt-2 text-sm text-[color:var(--sg-text-muted)]">{action.operator}</div>
                                        <div className="mt-2 text-sm text-[color:var(--sg-text-faint)]">{action.expected_effect}</div>
                                    </div>
                                ))}
                            </div>
                        </AdvisorActionCard>
                    </div>

                    <AdvisorActionCard title={copy.checklist} subtitle={copy.title}>
                        <ul className="space-y-2 text-sm text-[color:var(--sg-text-muted)]">
                            {analysis.monitoring_checklist.map((item) => (
                                <li
                                    key={item}
                                    className="sg-advisor-note"
                                >
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </AdvisorActionCard>
                </div>
            </div>
        );
    }

    return (
        <AdvisorLandedTabStatePanel
            {...props}
            title={copy.title}
            subtitle={
                locale === 'ko'
                    ? '이 탭은 현재 작물 상태에서 VPD, 캐노피 온도, 증산, 기공전도도, 광합성을 함께 읽어 생식·영양 균형과 스트레스 압력을 해석하는 재배생리 어드바이저 영역입니다.'
                    : 'This tab interprets vegetative versus generative balance and stress pressure from VPD, canopy temperature, transpiration, stomatal conductance, and photosynthesis.'
            }
            notes={locale === 'ko'
                ? [
                    '예상 출력: 생육 균형 해석, 보조 신호, 작업자용 다음 조치.',
                    copy.availableButNotRun,
                ]
                : [
                    'Expected outputs: crop-balance interpretation, supporting signals, and operator-facing follow-up actions.',
                    copy.availableButNotRun,
                ]}
        />
    );
};

export default PhysiologyTab;
