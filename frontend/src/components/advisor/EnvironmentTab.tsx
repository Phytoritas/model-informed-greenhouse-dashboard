import type { PlannedAdvisorTabPayload } from '../../hooks/useSmartGrowAdvisor';
import { useLocale } from '../../i18n/LocaleProvider';
import { getLocalizedTokenLabel } from '../../utils/displayCopy';
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
            plan: '3일 운영 계획',
            expectedEffects: '예상 효과',
            checklist: '확인 체크리스트',
            context: '현재 문맥',
            urgency: '긴급도',
            confidence: '확인 상태',
            diagnosis: '진단',
            operatingMode: '운영 모드',
            recoveryObjective: '회복 목표',
            targetBand: '목표 범위',
            targetBandUnavailable: 'RTR 목표 범위를 아직 계산하지 못했습니다.',
            deviation: '편차',
            hypotheses: '원인 가설',
            focusAreas: '조치 초점',
            riskFlags: '리스크 플래그',
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
            rtrBalance: 'RTR 균형',
            tempTrend: '온도 추세',
            humidityTrend: '습도 추세',
            vpdTrend: 'VPD 추세',
            nextHigh: '다음 최고기온',
            nextPrecip: '다음 강수확률',
            nextRadiation: '다음 일사',
            nextSunshine: '다음 일조',
            availableButNotRun: '환경 어드바이저는 이미 적용되어 있으며, 실행하면 현재 제어 제안을 확인할 수 있습니다.',
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
            urgency: 'Urgency',
            confidence: 'Review state',
            diagnosis: 'Diagnosis',
            operatingMode: 'Operating mode',
            recoveryObjective: 'Recovery objective',
            targetBand: 'Target band',
            targetBandUnavailable: 'RTR target band is unavailable.',
            deviation: 'Deviation',
            hypotheses: 'Cause hypotheses',
            focusAreas: 'Control focus',
            riskFlags: 'Risk flags',
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
            availableButNotRun: 'The environment advisor is already landed. Run it to inspect the current steering guidance.',
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

    const targetBand = analysis?.current_state.target_band === 'RTR target band unavailable'
        ? copy.targetBandUnavailable
        : analysis?.current_state.target_band;

    if (props.status !== 'error' && analysis) {
        return (
            <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
                <div className="sg-advisor-shell sg-advisor-shell-blue space-y-4">
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
                        title={copy.currentState}
                        subtitle={copy.title}
                        badges={
                            analysis.focus_areas.length
                                ? analysis.focus_areas.map((item) => getLocalizedTokenLabel(item, locale))
                                : [copy.focusAreas]
                        }
                    >
                        <div className="space-y-3 text-sm text-[color:var(--sg-text-muted)]">
                            <div>
                                <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.diagnosis}: </span>
                                {analysis.current_state.diagnosis}
                            </div>
                            <div>
                                <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.recoveryObjective}: </span>
                                {analysis.current_state.recovery_objective}
                            </div>
                            <div>
                                <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.targetBand}: </span>
                                {targetBand}
                            </div>
                            <div>
                                <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.deviation}: </span>
                                {analysis.current_state.deviation}
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

                    <AdvisorActionCard title={copy.context} subtitle={copy.title}>
                        <div className="grid gap-2 text-sm text-[color:var(--sg-text-muted)] sm:grid-cols-2">
                            <div>{copy.insideTemp}: {formatValue(analysis.context_snapshot.inside_temp_c, 1, ' °C')}</div>
                            <div>{copy.insideHumidity}: {formatValue(analysis.context_snapshot.inside_humidity_pct, 0, '%')}</div>
                            <div>{copy.insideVpd}: {formatValue(analysis.context_snapshot.inside_vpd_kpa, 2, ' kPa')}</div>
                            <div>{copy.insideCo2}: {formatValue(analysis.context_snapshot.inside_co2_ppm, 0, ' ppm')}</div>
                            <div>{copy.insideLight}: {formatValue(analysis.context_snapshot.inside_light_umol_m2_s, 0, ' µmol')}</div>
                            <div>{copy.outsideTemp}: {formatValue(analysis.context_snapshot.outside_temp_c, 1, ' °C')}</div>
                            <div>{copy.outsideHumidity}: {formatValue(analysis.context_snapshot.outside_humidity_pct, 0, '%')}</div>
                            <div>{copy.outsideCloud}: {formatValue(analysis.context_snapshot.outside_cloud_cover_pct, 0, '%')}</div>
                            <div>{copy.currentWeather}: {getLocalizedTokenLabel(analysis.context_snapshot.current_weather_label ?? '-', locale)}</div>
                            <div>{copy.rtrTarget}: {formatValue(analysis.context_snapshot.rtr_target_temp_c, 1, ' °C')}</div>
                            <div>{copy.rtrDelta}: {formatValue(analysis.context_snapshot.rtr_delta_temp_c, 1, ' °C')}</div>
                            <div>{copy.rtrBalance}: {getLocalizedTokenLabel(analysis.context_snapshot.rtr_balance_state ?? '-', locale)}</div>
                            <div>{copy.tempTrend}: {getLocalizedTokenLabel(analysis.context_snapshot.temperature_trend ?? '-', locale)}</div>
                            <div>{copy.humidityTrend}: {getLocalizedTokenLabel(analysis.context_snapshot.humidity_trend ?? '-', locale)}</div>
                            <div>{copy.vpdTrend}: {getLocalizedTokenLabel(analysis.context_snapshot.vpd_trend ?? '-', locale)}</div>
                            <div>{copy.nextHigh}: {formatValue(analysis.context_snapshot.next_day_high_temp_c, 1, ' °C')}</div>
                            <div>{copy.nextPrecip}: {formatValue(analysis.context_snapshot.next_day_precip_probability_pct, 0, '%')}</div>
                            <div>{copy.nextRadiation}: {formatValue(analysis.context_snapshot.next_day_radiation_mj_m2, 1, ' MJ m⁻²')}</div>
                            <div>{copy.nextSunshine}: {formatValue(analysis.context_snapshot.next_day_sunshine_h, 1, ' h')}</div>
                        </div>
                    </AdvisorActionCard>
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

                        <AdvisorActionCard title={copy.plan} subtitle={copy.title}>
                            <div className="space-y-3">
                                {analysis.three_day_plan.map((item) => (
                                    <div
                                        key={`${item.date}-${item.title}`}
                                        className="sg-advisor-inset"
                                    >
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                            {item.date}
                                        </div>
                                        <div className="mt-2 text-sm font-semibold text-[color:var(--sg-text-strong)]">{item.title}</div>
                                        <div className="mt-2 text-sm leading-relaxed text-[color:var(--sg-text-muted)]">
                                            {item.rationale}
                                        </div>
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
                    ? '이 탭은 실시간 센서, 날씨, RTR를 묶어 현재 환경 제어 제안을 보여주는 환경제어 어드바이저 영역입니다.'
                    : 'This tab combines live telemetry, weather, and RTR into the current steering guidance surface.'
            }
            notes={locale === 'ko'
                ? [
                    '예상 출력: 즉시 조치, 24시간 운영 제안, 3일 운영 계획.',
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
