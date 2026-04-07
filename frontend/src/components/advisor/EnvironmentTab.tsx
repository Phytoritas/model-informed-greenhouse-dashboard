import type { PlannedAdvisorTabPayload } from '../../hooks/useSmartGrowAdvisor';
import { useLocale } from '../../i18n/LocaleProvider';
import AdvisorActionCard from './AdvisorActionCard';
import AdvisorActionTimeline from './AdvisorActionTimeline';
import AdvisorConfidenceBadge from './AdvisorConfidenceBadge';
import AdvisorLandedTabStatePanel from './AdvisorLandedTabStatePanel';
import AdvisorModelRuntimePanel from './AdvisorModelRuntimePanel';

interface EnvironmentTabProps {
    status: 'idle' | 'loading' | 'success' | 'error';
    error: string | null;
    result?: PlannedAdvisorTabPayload;
    onRun: () => void;
}

const EnvironmentTab = (props: EnvironmentTabProps) => {
    const { locale } = useLocale();
    const analysis = props.result?.machine_payload.environment_analysis;
    const advisorActions = props.result?.machine_payload.advisor_actions;
    const retrievalContext = props.result?.machine_payload.retrieval_context;
    const knowledgeEvidence = props.result?.machine_payload.knowledge_evidence;
    const modelRuntime = props.result?.machine_payload.model_runtime;
    const copy = locale === 'ko'
        ? {
            title: '환경제어',
            summary: '환경 요약',
            actionTimeline: '행동 계획',
            actionNow: '지금 조치',
            actionToday: '오늘 조치',
            actionNext3d: '3일 계획',
            emptyActionWindow: '이 horizon에서는 즉시 추가할 행동 카드가 아직 없습니다.',
            currentState: '현재 상태 진단',
            immediate: '즉시 조치 (0~6h)',
            today: '오늘 조치 (24h)',
            plan: '3일 steering',
            expectedEffects: '예상 효과',
            checklist: '확인 체크리스트',
            context: '현재 문맥',
            knowledgeEvidence: '근거 지식',
            urgency: '긴급도',
            confidence: '신뢰도',
            diagnosis: '진단',
            operatingMode: '운영 모드',
            recoveryObjective: '회복 목표',
            targetBand: '목표 범위',
            deviation: '편차',
            hypotheses: '원인 가설',
            focusAreas: '조치 초점',
            riskFlags: '리스크 플래그',
            evidenceUnavailable: '이번 실행에서는 environment-domain 지식 검색을 사용할 수 없습니다.',
            evidenceDatabaseMissing: '지식 데이터베이스가 아직 준비되지 않아 environment 근거를 붙이지 못했습니다.',
            evidenceNoMatches: '현재 환경 문맥과 직접 매칭되는 추가 environment 근거는 찾지 못했습니다.',
            evidenceSkipped: '이번 실행에서는 별도 environment-domain retrieval이 요청되지 않았습니다.',
            insideTemp: '실내 온도',
            insideHumidity: '실내 습도',
            insideVpd: '실내 VPD',
            insideCo2: '실내 CO2',
            insideLight: '실내 광량',
            outsideTemp: '외기 온도',
            outsideHumidity: '외기 습도',
            outsideCloud: '외기 운량',
            currentWeather: '외기 상태',
            rtrTarget: 'RTR 목표온도',
            rtrDelta: 'RTR 편차',
            rtrBalance: 'RTR balance',
            tempTrend: '온도 추세',
            humidityTrend: '습도 추세',
            vpdTrend: 'VPD 추세',
            nextHigh: '다음 최고기온',
            nextPrecip: '다음 강수확률',
            nextRadiation: '다음 일사',
            nextSunshine: '다음 일조',
            availableButNotRun: 'deterministic environment advisor는 이미 landed 상태이며, 실행하면 현재 steering 제안을 확인할 수 있습니다.',
        }
        : {
            title: 'Environment',
            summary: 'Environment summary',
            actionTimeline: 'Action timeline',
            actionNow: 'Now',
            actionToday: 'Today',
            actionNext3d: 'Next 3 days',
            emptyActionWindow: 'No additional action card is mapped to this horizon yet.',
            currentState: 'Current state',
            immediate: 'Immediate actions (0-6h)',
            today: 'Today steering (24h)',
            plan: '3-day steering',
            expectedEffects: 'Expected effects',
            checklist: 'Monitoring checklist',
            context: 'Context snapshot',
            knowledgeEvidence: 'Knowledge evidence',
            urgency: 'Urgency',
            confidence: 'Confidence',
            diagnosis: 'Diagnosis',
            operatingMode: 'Operating mode',
            recoveryObjective: 'Recovery objective',
            targetBand: 'Target band',
            deviation: 'Deviation',
            hypotheses: 'Cause hypotheses',
            focusAreas: 'Control focus',
            riskFlags: 'Risk flags',
            evidenceUnavailable: 'The environment-domain knowledge retrieval is currently unavailable for this run.',
            evidenceDatabaseMissing: 'The knowledge database is not ready, so no environment-domain evidence could be attached.',
            evidenceNoMatches: 'No additional environment-domain evidence matched the current steering context.',
            evidenceSkipped: 'No separate environment-domain retrieval was requested for this run.',
            insideTemp: 'Inside temp',
            insideHumidity: 'Inside humidity',
            insideVpd: 'Inside VPD',
            insideCo2: 'Inside CO2',
            insideLight: 'Inside light',
            outsideTemp: 'Outside temp',
            outsideHumidity: 'Outside humidity',
            outsideCloud: 'Outside cloud cover',
            currentWeather: 'Outside weather',
            rtrTarget: 'RTR target',
            rtrDelta: 'RTR delta',
            rtrBalance: 'RTR balance',
            tempTrend: 'Temp trend',
            humidityTrend: 'Humidity trend',
            vpdTrend: 'VPD trend',
            nextHigh: 'Next high temp',
            nextPrecip: 'Next precip probability',
            nextRadiation: 'Next radiation',
            nextSunshine: 'Next sunshine',
            availableButNotRun: 'The deterministic environment advisor is already landed. Run it to inspect the current steering guidance.',
        };

    function getRetrievalStatusMessage(status: string | undefined) {
        switch (status) {
            case 'retrieval_unavailable':
                return copy.evidenceUnavailable;
            case 'database_missing':
                return copy.evidenceDatabaseMissing;
            case 'no_matches':
                return copy.evidenceNoMatches;
            default:
                return copy.evidenceSkipped;
        }
    }

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
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {copy.title}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">{copy.summary}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{analysis.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <AdvisorConfidenceBadge label={`${copy.urgency}:${analysis.urgency}`} tone="warning" />
                        <AdvisorConfidenceBadge
                            label={`${copy.confidence}:${Math.round(analysis.confidence * 100)}%`}
                            tone="info"
                        />
                        <AdvisorConfidenceBadge
                            label={`${copy.operatingMode}:${analysis.current_state.operating_mode}`}
                            tone="success"
                        />
                        {analysis.focus_areas.map((item) => (
                            <AdvisorConfidenceBadge key={item} label={item} tone="success" />
                        ))}
                        {props.result?.machine_payload.missing_data.map((item) => (
                            <AdvisorConfidenceBadge key={item} label={item} tone="neutral" />
                        ))}
                    </div>

                    <AdvisorActionCard
                        title={copy.currentState}
                        subtitle={copy.title}
                        badges={analysis.focus_areas.length ? analysis.focus_areas : [copy.focusAreas]}
                    >
                        <div className="space-y-3 text-sm text-slate-600">
                            <div>
                                <span className="font-semibold text-slate-900">{copy.diagnosis}: </span>
                                {analysis.current_state.diagnosis}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900">{copy.recoveryObjective}: </span>
                                {analysis.current_state.recovery_objective}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900">{copy.targetBand}: </span>
                                {analysis.current_state.target_band}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900">{copy.deviation}: </span>
                                {analysis.current_state.deviation}
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-slate-900">{copy.riskFlags}</div>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.current_state.risk_flags.map((item) => (
                                        <AdvisorConfidenceBadge key={item} label={item} tone="neutral" />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-slate-900">{copy.hypotheses}</div>
                                <ul className="space-y-2">
                                    {analysis.current_state.cause_hypotheses.map((item) => (
                                        <li
                                            key={item}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                                        >
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </AdvisorActionCard>

                    <AdvisorActionCard title={copy.context} subtitle={copy.title}>
                        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                            <div>{copy.insideTemp}: {formatValue(analysis.context_snapshot.inside_temp_c, 1, ' °C')}</div>
                            <div>{copy.insideHumidity}: {formatValue(analysis.context_snapshot.inside_humidity_pct, 0, '%')}</div>
                            <div>{copy.insideVpd}: {formatValue(analysis.context_snapshot.inside_vpd_kpa, 2, ' kPa')}</div>
                            <div>{copy.insideCo2}: {formatValue(analysis.context_snapshot.inside_co2_ppm, 0, ' ppm')}</div>
                            <div>{copy.insideLight}: {formatValue(analysis.context_snapshot.inside_light_umol_m2_s, 0, ' µmol')}</div>
                            <div>{copy.outsideTemp}: {formatValue(analysis.context_snapshot.outside_temp_c, 1, ' °C')}</div>
                            <div>{copy.outsideHumidity}: {formatValue(analysis.context_snapshot.outside_humidity_pct, 0, '%')}</div>
                            <div>{copy.outsideCloud}: {formatValue(analysis.context_snapshot.outside_cloud_cover_pct, 0, '%')}</div>
                            <div>{copy.currentWeather}: {analysis.context_snapshot.current_weather_label ?? '-'}</div>
                            <div>{copy.rtrTarget}: {formatValue(analysis.context_snapshot.rtr_target_temp_c, 1, ' °C')}</div>
                            <div>{copy.rtrDelta}: {formatValue(analysis.context_snapshot.rtr_delta_temp_c, 1, ' °C')}</div>
                            <div>{copy.rtrBalance}: {analysis.context_snapshot.rtr_balance_state ?? '-'}</div>
                            <div>{copy.tempTrend}: {analysis.context_snapshot.temperature_trend ?? '-'}</div>
                            <div>{copy.humidityTrend}: {analysis.context_snapshot.humidity_trend ?? '-'}</div>
                            <div>{copy.vpdTrend}: {analysis.context_snapshot.vpd_trend ?? '-'}</div>
                            <div>{copy.nextHigh}: {formatValue(analysis.context_snapshot.next_day_high_temp_c, 1, ' °C')}</div>
                            <div>{copy.nextPrecip}: {formatValue(analysis.context_snapshot.next_day_precip_probability_pct, 0, '%')}</div>
                            <div>{copy.nextRadiation}: {formatValue(analysis.context_snapshot.next_day_radiation_mj_m2, 1, ' MJ m⁻²')}</div>
                            <div>{copy.nextSunshine}: {formatValue(analysis.context_snapshot.next_day_sunshine_h, 1, ' h')}</div>
                        </div>
                    </AdvisorActionCard>
                    {retrievalContext ? (
                        <AdvisorActionCard
                            title={copy.knowledgeEvidence}
                            subtitle={copy.title}
                            badges={[
                                retrievalContext.status,
                                ...(knowledgeEvidence?.focus_domains ?? retrievalContext.focus_domains ?? []),
                            ]}
                        >
                            {knowledgeEvidence?.evidence_cards?.length ? (
                                <div className="space-y-3">
                                    {knowledgeEvidence.evidence_cards.map((card, index) => (
                                        <div
                                            key={`${card.domain ?? card.topic_minor ?? 'evidence'}-${index}`}
                                            className="rounded-2xl border border-slate-200 bg-white p-4"
                                        >
                                            <div className="flex flex-wrap gap-2">
                                                {card.domain ? (
                                                    <AdvisorConfidenceBadge label={card.domain} tone="info" />
                                                ) : null}
                                                {card.topic_major ? (
                                                    <AdvisorConfidenceBadge label={card.topic_major} tone="success" />
                                                ) : null}
                                                {card.topic_minor ? (
                                                    <AdvisorConfidenceBadge label={card.topic_minor} tone="neutral" />
                                                ) : null}
                                            </div>
                                            <div className="mt-2 text-sm leading-relaxed text-slate-600">
                                                {card.evidence_excerpt}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm leading-relaxed text-slate-500">
                                    {getRetrievalStatusMessage(retrievalContext.status)}
                                </div>
                            )}
                        </AdvisorActionCard>
                    ) : null}
                </div>

                <div className="space-y-4">
                    {modelRuntime !== undefined ? (
                        <AdvisorModelRuntimePanel runtime={modelRuntime} />
                    ) : null}
                    {advisorActions ? (
                        <AdvisorActionTimeline
                            title={copy.actionTimeline}
                            subtitle={copy.summary}
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
                        <AdvisorActionCard title={copy.expectedEffects} subtitle={copy.title}>
                            <ul className="space-y-2 text-sm text-slate-600">
                                {analysis.expected_effects.map((item) => (
                                    <li
                                        key={item}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                                    >
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </AdvisorActionCard>

                        <AdvisorActionCard title={copy.plan} subtitle={copy.title}>
                            <div className="space-y-3">
                                {analysis.three_day_plan.map((item) => (
                                    <div
                                        key={`${item.date}-${item.title}`}
                                        className="rounded-2xl border border-slate-200 bg-white p-4"
                                    >
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {item.date}
                                        </div>
                                        <div className="mt-2 text-sm font-semibold text-slate-900">{item.title}</div>
                                        <div className="mt-2 text-sm leading-relaxed text-slate-600">
                                            {item.rationale}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AdvisorActionCard>
                    </div>

                    <AdvisorActionCard title={copy.checklist} subtitle={copy.title}>
                        <ul className="space-y-2 text-sm text-slate-600">
                            {analysis.monitoring_checklist.map((item) => (
                                <li
                                    key={item}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2"
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
                    ? '이 탭은 live telemetry, weather, RTR를 묶어 현재 steering 제안을 보여주는 환경 advisor 영역입니다.'
                    : 'This tab combines live telemetry, weather, and RTR into the current steering guidance surface.'
            }
            notes={locale === 'ko'
                ? [
                    '예상 출력: 즉시 조치, 24시간 steering, 3일 plan.',
                    copy.availableButNotRun,
                ]
                : [
                    'Expected outputs: immediate action, next-24h steering, and 3-day plan.',
                    copy.availableButNotRun,
                ]}
        />
    );
};

export default EnvironmentTab;
