import type { PlannedAdvisorTabPayload } from '../../hooks/useSmartGrowAdvisor';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatReadinessBadge, getReadinessDescriptor } from '../../lib/design/readiness';
import { getLocalizedTokenLabel } from '../../utils/displayCopy';
import AdvisorActionCard from './AdvisorActionCard';
import AdvisorActionTimeline from './AdvisorActionTimeline';
import AdvisorConfidenceBadge from './AdvisorConfidenceBadge';
import AdvisorLandedTabStatePanel from './AdvisorLandedTabStatePanel';
import AdvisorModelRuntimePanel from './AdvisorModelRuntimePanel';

interface WorkTabProps {
    status: 'idle' | 'loading' | 'success' | 'error';
    error: string | null;
    result?: PlannedAdvisorTabPayload;
    onRun: () => void;
}

const WorkTab = (props: WorkTabProps) => {
    const { locale } = useLocale();
    const analysis = props.result?.machine_payload.work_analysis;
    const advisorActions = props.result?.machine_payload.advisor_actions;
    const modelRuntime = props.result?.machine_payload.model_runtime;
    const workEventCompare = props.result?.machine_payload.work_event_compare;
    const readiness = getReadinessDescriptor(analysis?.confidence, locale);
    const copy = locale === 'ko'
        ? {
            title: '재배작업',
            summary: '작업 요약',
            workEventCompare: '작업 이벤트 비교',
            compareHistory: '최근 작업 이력',
            compareCurrentState: '비교 기준 상태',
            compareRecommended: '권장 조치',
            compareUnavailable: '저장된 모델 스냅샷이 아직 없어 작업 이벤트 재생 비교를 만들 수 없습니다.',
            compareYield7d: '7일 수량',
            compareYield14d: '14일 수량',
            compareCanopyA: '72시간 캐노피 동화량',
            compareBalance: '균형 점수',
            compareRisk: '리스크',
            compareOperatorNote: '해석',
            compareImmediateDelta: '즉시 상태 변화',
            compareLeafGuard: '엽수 안전선',
            compareSinkOverload: '싱크 과부하',
            compareFruitDm14d: '14일 과실 건물중',
            compareLai14d: '14일 LAI',
            compareAgronomy: '재배 메모',
            compareNoHistory: '아직 저장된 작업 이력이 없습니다.',
            actionTimeline: '행동 계획',
            actionNow: '지금 조치',
            actionToday: '오늘 조치',
            actionNext3d: '3일 계획',
            emptyActionWindow: '이 horizon에서는 즉시 추가할 행동 카드가 아직 없습니다.',
            actionPriority: '우선 작업',
            timeWindows: '작업 창',
            currentState: '현재 작업 상태',
            operatingMode: '운영 모드',
            primaryConstraint: '핵심 제약',
            laborStrategy: '작업 전략',
            workloadBalance: '작업 균형',
            diagnosis: '진단',
            deviation: '편차',
            hypotheses: '원인 가설',
            riskFlags: '리스크 플래그',
            expectedEffects: '예상 효과',
            checklist: '확인 체크리스트',
            context: '현재 문맥',
            urgency: '긴급도',
            confidence: '반영 상태',
            emptyActions: '현재 문맥에서 강한 작업 트리거가 아직 잡히지 않았습니다.',
            nextDayHarvest: '다음 수확량',
            nextDayEtc: '다음 ETc',
            dailyEnergy: '일일 에너지',
            activeTrusses: '활성 화방',
            nodeCount: '마디 수',
            harvestableFruits: '수확 가능 과실',
            humidity: '습도',
            vpd: 'VPD',
            rtrDelta: 'RTR 편차',
            forecastHighTemp: '예상 최고기온',
            availableButNotRun: '작업 어드바이저는 이미 적용되어 있으며, 실행하면 현재 작업 우선순위를 확인할 수 있습니다.',
        }
        : {
            title: 'Work',
            summary: 'Work summary',
            workEventCompare: 'Work comparison',
            compareHistory: 'Recent work history',
            compareCurrentState: 'Baseline state',
            compareRecommended: 'Recommended action',
            compareUnavailable: 'No persisted model snapshot is available for work-event replay compare yet.',
            compareYield7d: '7d yield',
            compareYield14d: '14d yield',
            compareCanopyA: '72h canopy A',
            compareBalance: 'Balance score',
            compareRisk: 'Risk',
            compareOperatorNote: 'Interpretation',
            compareImmediateDelta: 'Immediate state delta',
            compareNoHistory: 'No persisted work event has been logged yet.',
            actionTimeline: 'Action timeline',
            actionNow: 'Now',
            actionToday: 'Today',
            actionNext3d: 'Next 3 days',
            emptyActionWindow: 'No additional action card is mapped to this horizon yet.',
            actionPriority: 'Priority actions',
            timeWindows: 'Work windows',
            currentState: 'Current work state',
            operatingMode: 'Operating mode',
            primaryConstraint: 'Primary constraint',
            laborStrategy: 'Labor strategy',
            workloadBalance: 'Workload balance',
            diagnosis: 'Diagnosis',
            deviation: 'Deviation',
            hypotheses: 'Cause hypotheses',
            riskFlags: 'Risk flags',
            expectedEffects: 'Expected effects',
            checklist: 'Monitoring checklist',
            context: 'Context snapshot',
            urgency: 'Urgency',
            confidence: 'Readiness',
            emptyActions: 'No strong cultivation-work trigger was detected from the current context.',
            nextDayHarvest: 'Next-day harvest',
            nextDayEtc: 'Next-day ETc',
            dailyEnergy: 'Daily energy',
            activeTrusses: 'Active trusses',
            nodeCount: 'Node count',
            harvestableFruits: 'Harvestable fruits',
            humidity: 'Humidity',
            vpd: 'VPD',
            rtrDelta: 'RTR delta',
            forecastHighTemp: 'Forecast high temp',
            availableButNotRun: 'The work advisor is already landed. Run it to inspect the current cultivation priorities.',
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

    function formatSignedValue(
        value: number | null | undefined,
        digits = 2,
        unit = '',
    ) {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return '-';
        }
        const prefix = value > 0 ? '+' : '';
        return `${prefix}${value.toFixed(digits)}${unit}`;
    }

    function formatDeltaLabel(key: string) {
        switch (key) {
            case 'leaf_count_delta':
                return locale === 'ko' ? '엽수' : 'Leaf count';
            case 'lai_delta':
                return 'LAI';
            case 'fruit_load_delta':
                return locale === 'ko' ? '착과 부하' : 'Fruit load';
            case 'sink_demand_delta':
                return locale === 'ko' ? '싱크 요구량' : 'Sink demand';
            case 'source_capacity_delta':
                return locale === 'ko' ? '소스 용량' : 'Source capacity';
            case 'fruit_partition_ratio_delta':
                return locale === 'ko' ? '과실 분배율' : 'Fruit partition';
            default:
                return key;
        }
    }

    if (props.status !== 'error' && analysis) {
        return (
            <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)]">
                <div className="sg-advisor-shell sg-advisor-shell-amber space-y-4">
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
                            label={formatReadinessBadge(analysis.confidence, locale, copy.confidence)}
                            tone={readiness.tone}
                        />
                        <AdvisorConfidenceBadge
                            label={`${copy.operatingMode}:${getLocalizedTokenLabel(analysis.current_state.operating_mode, locale)}`}
                            tone="success"
                        />
                        {analysis.focus_areas.map((item) => (
                            <AdvisorConfidenceBadge
                                key={item}
                                label={getLocalizedTokenLabel(item, locale)}
                                tone="success"
                            />
                        ))}
                        {props.result?.machine_payload.missing_data.map((item) => (
                            <AdvisorConfidenceBadge
                                key={item}
                                label={getLocalizedTokenLabel(item, locale)}
                                tone="neutral"
                            />
                        ))}
                    </div>
                    <AdvisorActionCard
                        title={copy.context}
                        subtitle={copy.title}
                        badges={analysis.monitoring_checklist.slice(0, 2)}
                    >
                        <div className="grid gap-2 text-sm text-[color:var(--sg-text-muted)] sm:grid-cols-2">
                            <div>{copy.nextDayHarvest}: {formatValue(analysis.context_snapshot.next_day_harvest_kg, 2, ' kg')}</div>
                            <div>{copy.nextDayEtc}: {formatValue(analysis.context_snapshot.next_day_etc_mm, 1, ' mm')}</div>
                            <div>{copy.dailyEnergy}: {formatValue(analysis.context_snapshot.daily_energy_kwh, 1, ' kWh')}</div>
                            <div>{copy.activeTrusses}: {formatValue(analysis.context_snapshot.active_trusses, 0)}</div>
                            <div>{copy.nodeCount}: {formatValue(analysis.context_snapshot.node_count, 0)}</div>
                            <div>{copy.harvestableFruits}: {formatValue(analysis.context_snapshot.harvestable_fruits, 0)}</div>
                            <div>{copy.humidity}: {formatValue(analysis.context_snapshot.humidity_pct, 0, '%')}</div>
                            <div>{copy.vpd}: {formatValue(analysis.context_snapshot.vpd_kpa, 2, ' kPa')}</div>
                            <div>{copy.rtrDelta}: {formatValue(analysis.context_snapshot.rtr_delta_temp_c, 1, ' °C')}</div>
                            <div>{copy.forecastHighTemp}: {formatValue(analysis.context_snapshot.forecast_high_temp_c, 1, ' °C')}</div>
                        </div>
                    </AdvisorActionCard>
                </div>

                <div className="space-y-4">
                    {modelRuntime !== undefined ? (
                        <AdvisorModelRuntimePanel runtime={modelRuntime} />
                    ) : null}
                    {workEventCompare ? (
                        <AdvisorActionCard
                            title={copy.workEventCompare}
                            subtitle={workEventCompare.summary}
                            badges={[
                                getLocalizedTokenLabel(workEventCompare.status, locale),
                                formatReadinessBadge(workEventCompare.confidence ?? null, locale, copy.confidence),
                                ...(workEventCompare.recommended_action
                                    ? [`${copy.compareRecommended}:${workEventCompare.recommended_action}`]
                                    : []),
                            ]}
                        >
                            {workEventCompare.status === 'history-unavailable' ? (
                                <div className="text-sm leading-relaxed text-[color:var(--sg-text-faint)]">
                                    {workEventCompare.summary || copy.compareUnavailable}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid gap-2 text-sm text-[color:var(--sg-text-muted)] sm:grid-cols-2 xl:grid-cols-3">
                                        <div>{copy.compareCurrentState}: {formatValue(workEventCompare.current_state.leaf_count, 0)}</div>
                                        <div>LAI: {formatValue(workEventCompare.current_state.lai, 2)}</div>
                                        <div>{copy.harvestableFruits}: {formatValue(workEventCompare.current_state.fruit_load, 0)}</div>
                                        <div>{copy.activeTrusses}: {formatValue(workEventCompare.current_state.active_trusses, 0)}</div>
                                        <div>{copy.compareBalance}: {formatSignedValue(workEventCompare.current_state.source_sink_balance, 2)}</div>
                                        <div>{copy.compareLeafGuard}: {formatValue(workEventCompare.current_state.minimum_leaf_guard, 0)}</div>
                                        <div>{copy.compareSinkOverload}: {formatValue(workEventCompare.current_state.sink_overload_score, 2)}</div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                            {copy.compareHistory}
                                        </div>
                                        {workEventCompare.history.length ? (
                                            <div className="flex flex-wrap gap-2">
                                                {workEventCompare.history.map((item) => (
                                                    <AdvisorConfidenceBadge
                                                        key={`${item.event_time ?? item.action}-${item.action}`}
                                                        label={getLocalizedTokenLabel(item.action, locale)}
                                                        tone="neutral"
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-[color:var(--sg-text-faint)]">{copy.compareNoHistory}</div>
                                        )}
                                    </div>

                                    <div className="grid gap-3 xl:grid-cols-3">
                                        {workEventCompare.options.map((option) => (
                                            <div
                                                key={`${option.comparison_kind}-${option.action}`}
                                                className="sg-advisor-inset"
                                            >
                                                <div className="flex flex-wrap gap-2">
                                                    <AdvisorConfidenceBadge label={option.action} tone="success" />
                                                    <AdvisorConfidenceBadge
                                                        label={`${copy.compareRisk}:${getLocalizedTokenLabel(option.risk, locale)}`}
                                                        tone={option.risk === 'high' ? 'warning' : option.risk === 'medium' ? 'info' : 'neutral'}
                                                    />
                                                </div>
                                                <div className="mt-3 space-y-2 text-sm text-[color:var(--sg-text-muted)]">
                                                    <div>
                                                        <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.compareOperatorNote}: </span>
                                                        {option.operator_note}
                                                    </div>
                                                    <div>{copy.compareYield7d}: {formatSignedValue(option.expected_yield_delta_7d, 2, ' kg')}</div>
                                                    <div>{copy.compareYield14d}: {formatSignedValue(option.expected_yield_delta_14d, 2, ' kg')}</div>
                                                    <div>{copy.compareFruitDm14d}: {formatSignedValue(option.expected_fruit_dm_delta_14d, 2)}</div>
                                                    <div>{copy.compareLai14d}: {formatSignedValue(option.expected_lai_delta_14d, 2)}</div>
                                                    <div>{copy.compareCanopyA}: {formatSignedValue(option.expected_canopy_a_delta_72h, 2)}</div>
                                                    <div>{copy.compareBalance}: {formatSignedValue(option.expected_source_sink_balance_delta, 3)}</div>
                                                    {(option.agronomy_flags?.length ?? 0) > 0 ? (
                                                        <div className="space-y-2">
                                                            <div className="font-semibold text-[color:var(--sg-text-strong)]">{copy.compareAgronomy}</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(option.agronomy_flags ?? []).map((flag: string) => (
                                                                    <AdvisorConfidenceBadge
                                                                        key={flag}
                                                                        label={getLocalizedTokenLabel(flag, locale)}
                                                                        tone="neutral"
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                    <div className="space-y-2">
                                                        <div className="font-semibold text-[color:var(--sg-text-strong)]">{copy.compareImmediateDelta}</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(option.immediate_state_delta ?? {}).map(([key, value]) => (
                                                                <AdvisorConfidenceBadge
                                                                    key={key}
                                                                    label={`${formatDeltaLabel(key)} ${formatSignedValue(value, 2)}`}
                                                                    tone="neutral"
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </AdvisorActionCard>
                    ) : null}
                    {advisorActions ? (
                        <AdvisorActionTimeline
                            title={copy.actionTimeline}
                            subtitle={analysis.summary}
                            actions={advisorActions}
                            labels={{
                                now: copy.actionNow,
                                today: copy.actionToday,
                                next3d: copy.actionNext3d,
                                empty: copy.emptyActionWindow,
                            }}
                        />
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                        <AdvisorActionCard
                            title={copy.currentState}
                            subtitle={copy.title}
                            badges={
                                analysis.focus_areas.length
                                    ? analysis.focus_areas.map((item) => getLocalizedTokenLabel(item, locale))
                                    : [getLocalizedTokenLabel(analysis.current_state.workload_balance, locale)]
                            }
                        >
                            <div className="space-y-3 text-sm text-[color:var(--sg-text-muted)]">
                                <div>
                                    <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.diagnosis}: </span>
                                    {analysis.current_state.diagnosis}
                                </div>
                                <div>
                                    <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.operatingMode}: </span>
                                    {getLocalizedTokenLabel(analysis.current_state.operating_mode, locale)}
                                </div>
                                <div>
                                    <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.primaryConstraint}: </span>
                                    {getLocalizedTokenLabel(analysis.current_state.primary_constraint, locale)}
                                </div>
                                <div>
                                    <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.laborStrategy}: </span>
                                    {getLocalizedTokenLabel(analysis.current_state.labor_strategy, locale)}
                                </div>
                                <div>
                                    <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.workloadBalance}: </span>
                                    {getLocalizedTokenLabel(analysis.current_state.workload_balance, locale)}
                                </div>
                                <div>
                                    <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.deviation}: </span>
                                    {getLocalizedTokenLabel(analysis.current_state.deviation, locale)}
                                </div>
                                <div className="space-y-2">
                                    <div className="font-semibold text-[color:var(--sg-text-strong)]">{copy.riskFlags}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.current_state.risk_flags.map((item) => (
                                            <AdvisorConfidenceBadge
                                                key={item}
                                                label={getLocalizedTokenLabel(item, locale)}
                                                tone="neutral"
                                            />
                                        ))}
                                    </div>
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

                        <AdvisorActionCard title={copy.expectedEffects} subtitle={copy.title}>
                            <ul className="space-y-2 text-sm text-[color:var(--sg-text-muted)]">
                                {analysis.expected_effects.map((item) => (
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
                    ? '이 탭은 현재 작물 상태에서 적엽, 유인, 수확, 관수 등 작업 우선순위를 정리하는 재배작업 어드바이저 영역입니다.'
                    : 'This tab prioritizes pruning, training, harvest, and cultivation work from the current crop state.'
            }
            notes={locale === 'ko'
                ? [
                    '예상 출력: 우선순위 작업 액션과 작업 누락·과부하 리스크.',
                    copy.availableButNotRun,
                ]
                : [
                    'Expected outputs: prioritized work actions and workload-related risks.',
                    copy.availableButNotRun,
                ]}
        />
    );
};

export default WorkTab;
