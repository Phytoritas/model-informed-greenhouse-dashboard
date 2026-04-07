import type { PlannedAdvisorTabPayload } from '../../hooks/useSmartGrowAdvisor';
import { useLocale } from '../../i18n/LocaleProvider';
import AdvisorActionCard from './AdvisorActionCard';
import AdvisorConfidenceBadge from './AdvisorConfidenceBadge';
import AdvisorLandedTabStatePanel from './AdvisorLandedTabStatePanel';
import AdvisorModelRuntimePanel from './AdvisorModelRuntimePanel';

interface HarvestMarketTabProps {
    status: 'idle' | 'loading' | 'success' | 'error';
    error: string | null;
    result?: PlannedAdvisorTabPayload;
    onRun: () => void;
}

const HarvestMarketTab = (props: HarvestMarketTabProps) => {
    const { locale } = useLocale();
    const analysis = props.result?.machine_payload.harvest_market_analysis;
    const retrievalContext = props.result?.machine_payload.retrieval_context;
    const knowledgeEvidence = props.result?.machine_payload.knowledge_evidence;
    const modelRuntime = props.result?.machine_payload.model_runtime;
    const copy = locale === 'ko'
        ? {
            title: '수확 / 가격',
            summary: '수확/가격 요약',
            currentState: '현재 상태',
            context: '현재 문맥',
            knowledgeEvidence: '근거 지식',
            actionPriority: '우선 조치',
            marketWatchlist: '시장 감시',
            timeWindows: '작업 창',
            checklist: '확인 체크리스트',
            urgency: '긴급도',
            confidence: '신뢰도',
            evidenceUnavailable: '이번 실행에서는 harvest/market-domain 지식 검색을 사용할 수 없습니다.',
            evidenceDatabaseMissing: '지식 데이터베이스가 아직 준비되지 않아 harvest/market 근거를 붙이지 못했습니다.',
            evidenceNoMatches: '현재 수확/가격 문맥과 직접 매칭되는 추가 harvest/market 근거는 찾지 못했습니다.',
            evidenceSkipped: '이번 실행에서는 별도 harvest/market-domain retrieval이 요청되지 않았습니다.',
            harvestOutlook: '수확 전망',
            marketOutlook: '시장 전망',
            tradeoffFocus: '운영 초점',
            cropSpecific: '작물 문맥',
            nextDayHarvest: '다음 수확량',
            totalHarvest: '누적 수확량',
            predictedWeeklyYield: '주간 예측 수확',
            harvestableFruits: '수확 가능 과실',
            activeTrusses: '활성 화방',
            nodeCount: '마디 수',
            dailyEnergy: '일일 에너지',
            humidity: '습도',
            vpd: 'VPD',
            rtrDelta: 'RTR 편차',
            rtrBalance: 'RTR balance',
            forecastHighTemp: '예상 최고기온',
            forecastPrecip: '예상 강수확률',
            nextDayWeather: '다음 날씨',
            retailPrice: '소매가',
            wholesalePrice: '도매가',
            marketRefDay: '시장 기준일',
            seasonalBias: '계절선 위치',
            noActions: '현재 문맥에서는 급한 출하/수확 재배치 트리거가 제한적입니다.',
            noWatchlist: '현재 crop과 직접 매칭되는 가격 스냅샷이 아직 없습니다.',
            availableButNotRun: 'deterministic harvest/market advisor는 이미 landed 상태이며, 실행하면 수확 전망과 가격 컨텍스트를 함께 확인할 수 있습니다.',
        }
        : {
            title: 'Harvest & Market',
            summary: 'Harvest and market summary',
            currentState: 'Current state',
            context: 'Context snapshot',
            knowledgeEvidence: 'Knowledge evidence',
            actionPriority: 'Priority actions',
            marketWatchlist: 'Market watchlist',
            timeWindows: 'Timing windows',
            checklist: 'Monitoring checklist',
            urgency: 'Urgency',
            confidence: 'Confidence',
            evidenceUnavailable: 'The harvest/market-domain knowledge retrieval is currently unavailable for this run.',
            evidenceDatabaseMissing: 'The knowledge database is not ready, so no harvest/market-domain evidence could be attached.',
            evidenceNoMatches: 'No additional harvest/market-domain evidence matched the current shipment and price context.',
            evidenceSkipped: 'No separate harvest/market-domain retrieval was requested for this run.',
            harvestOutlook: 'Harvest outlook',
            marketOutlook: 'Market outlook',
            tradeoffFocus: 'Tradeoff focus',
            cropSpecific: 'Crop context',
            nextDayHarvest: 'Next-day harvest',
            totalHarvest: 'Total harvest',
            predictedWeeklyYield: 'Predicted weekly yield',
            harvestableFruits: 'Harvestable fruits',
            activeTrusses: 'Active trusses',
            nodeCount: 'Node count',
            dailyEnergy: 'Daily energy',
            humidity: 'Humidity',
            vpd: 'VPD',
            rtrDelta: 'RTR delta',
            rtrBalance: 'RTR balance',
            forecastHighTemp: 'Forecast high temp',
            forecastPrecip: 'Forecast precip probability',
            nextDayWeather: 'Next-day weather',
            retailPrice: 'Retail price',
            wholesalePrice: 'Wholesale price',
            marketRefDay: 'Market reference day',
            seasonalBias: 'Seasonal bias',
            noActions: 'No strong harvest or shipment trigger was detected from the current context.',
            noWatchlist: 'No crop-matched market snapshot is available yet.',
            availableButNotRun: 'The deterministic harvest/market advisor is already landed. Run it to inspect harvest outlook and price-aware steering together.',
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

    function formatPrice(value: number | null | undefined) {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return '-';
        }
        return `₩${Math.round(value).toLocaleString()}`;
    }

    function watchTone(
        seasonalBias: string | null | undefined,
        direction: string | null | undefined,
    ): 'neutral' | 'info' | 'success' | 'warning' {
        if (seasonalBias === 'above-seasonal-normal' && direction === 'up') {
            return 'success';
        }
        if (seasonalBias === 'below-seasonal-normal' || direction === 'down') {
            return 'warning';
        }
        if (seasonalBias === 'near-seasonal-normal') {
            return 'info';
        }
        return 'neutral';
    }

    if (props.status !== 'error' && analysis) {
        return (
            <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)]">
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
                        {props.result?.machine_payload.missing_data.map((item) => (
                            <AdvisorConfidenceBadge key={item} label={item} tone="neutral" />
                        ))}
                    </div>

                    <AdvisorActionCard title={copy.currentState} subtitle={copy.title}>
                        <div className="space-y-3 text-sm text-slate-600">
                            <div>
                                <span className="font-semibold text-slate-900">{copy.harvestOutlook}: </span>
                                {analysis.current_state.harvest_outlook}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900">{copy.marketOutlook}: </span>
                                {analysis.current_state.market_outlook}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900">{copy.tradeoffFocus}: </span>
                                {analysis.current_state.tradeoff_focus}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900">{copy.cropSpecific}: </span>
                                {analysis.current_state.crop_specific_context}
                            </div>
                        </div>
                    </AdvisorActionCard>

                    <AdvisorActionCard title={copy.context} subtitle={copy.title}>
                        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                            <div>{copy.nextDayHarvest}: {formatValue(analysis.context_snapshot.next_day_harvest_kg, 2, ' kg')}</div>
                            <div>{copy.totalHarvest}: {formatValue(analysis.context_snapshot.total_harvest_kg, 2, ' kg')}</div>
                            <div>{copy.predictedWeeklyYield}: {formatValue(analysis.context_snapshot.predicted_weekly_yield_kg, 2, ' kg')}</div>
                            <div>{copy.harvestableFruits}: {formatValue(analysis.context_snapshot.harvestable_fruits, 0)}</div>
                            <div>{copy.activeTrusses}: {formatValue(analysis.context_snapshot.active_trusses, 0)}</div>
                            <div>{copy.nodeCount}: {formatValue(analysis.context_snapshot.node_count, 0)}</div>
                            <div>{copy.dailyEnergy}: {formatValue(analysis.context_snapshot.daily_energy_kwh, 1, ' kWh')}</div>
                            <div>{copy.humidity}: {formatValue(analysis.context_snapshot.humidity_pct, 0, '%')}</div>
                            <div>{copy.vpd}: {formatValue(analysis.context_snapshot.vpd_kpa, 2, ' kPa')}</div>
                            <div>{copy.rtrDelta}: {formatValue(analysis.context_snapshot.rtr_delta_temp_c, 1, ' °C')}</div>
                            <div>{copy.rtrBalance}: {analysis.context_snapshot.rtr_balance_state ?? '-'}</div>
                            <div>{copy.forecastHighTemp}: {formatValue(analysis.context_snapshot.forecast_high_temp_c, 1, ' °C')}</div>
                            <div>{copy.forecastPrecip}: {formatValue(analysis.context_snapshot.forecast_precip_probability_pct, 0, '%')}</div>
                            <div>{copy.nextDayWeather}: {analysis.context_snapshot.next_day_weather_label ?? '-'}</div>
                            <div>{copy.retailPrice}: {formatPrice(analysis.context_snapshot.retail_price_krw)}</div>
                            <div>{copy.wholesalePrice}: {formatPrice(analysis.context_snapshot.wholesale_price_krw)}</div>
                            <div>{copy.marketRefDay}: {analysis.context_snapshot.market_reference_day ?? '-'}</div>
                            <div>{copy.seasonalBias}: {analysis.context_snapshot.seasonal_bias ?? '-'}</div>
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
                    <div className="grid gap-4 xl:grid-cols-2">
                        <AdvisorActionCard title={copy.actionPriority} subtitle={copy.title}>
                            <div className="space-y-3">
                                {analysis.priority_actions.length === 0 ? (
                                    <div className="text-sm text-slate-500">{copy.noActions}</div>
                                ) : analysis.priority_actions.map((action) => (
                                    <div
                                        key={`${action.time_window}-${action.title}`}
                                        className="rounded-2xl border border-slate-200 bg-white p-4"
                                    >
                                        <div className="flex flex-wrap gap-2">
                                            <AdvisorConfidenceBadge label={action.priority} tone="warning" />
                                            <AdvisorConfidenceBadge label={action.time_window} tone="info" />
                                        </div>
                                        <div className="mt-3 text-sm font-semibold text-slate-900">
                                            {action.title}
                                        </div>
                                        <div className="mt-2 text-sm leading-relaxed text-slate-600">
                                            {action.rationale}
                                        </div>
                                        <div className="mt-2 text-sm text-slate-600">{action.operator}</div>
                                        <div className="mt-2 text-sm text-slate-500">{action.expected_effect}</div>
                                    </div>
                                ))}
                            </div>
                        </AdvisorActionCard>

                        <AdvisorActionCard title={copy.marketWatchlist} subtitle={copy.title}>
                            <div className="space-y-3">
                                {analysis.market_watchlist.length === 0 ? (
                                    <div className="text-sm text-slate-500">{copy.noWatchlist}</div>
                                ) : analysis.market_watchlist.map((item) => (
                                    <div
                                        key={`${item.market_label}-${item.display_name}`}
                                        className="rounded-2xl border border-slate-200 bg-white p-4"
                                    >
                                        <div className="flex flex-wrap gap-2">
                                            <AdvisorConfidenceBadge
                                                label={item.market_label}
                                                tone={watchTone(item.seasonal_bias, item.direction)}
                                            />
                                            <AdvisorConfidenceBadge label={item.direction ?? 'flat'} tone="neutral" />
                                            {item.seasonal_bias ? (
                                                <AdvisorConfidenceBadge label={item.seasonal_bias} tone="info" />
                                            ) : null}
                                        </div>
                                        <div className="mt-3 text-sm font-semibold text-slate-900">
                                            {item.display_name}
                                        </div>
                                        <div className="mt-2 text-sm text-slate-600">
                                            {formatPrice(item.current_price_krw)}
                                            {item.day_over_day_pct !== null && item.day_over_day_pct !== undefined
                                                ? ` (${item.day_over_day_pct.toFixed(1)}%)`
                                                : ''}
                                        </div>
                                        <div className="mt-2 text-sm leading-relaxed text-slate-600">
                                            {item.interpretation}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AdvisorActionCard>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                        <AdvisorActionCard title={copy.timeWindows} subtitle={copy.title}>
                            <div className="space-y-3">
                                {analysis.timing_windows.map((window) => (
                                    <div
                                        key={window.window}
                                        className="rounded-2xl border border-slate-200 bg-white p-4"
                                    >
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {window.window}
                                        </div>
                                        <div className="mt-2 text-sm font-semibold text-slate-900">
                                            {window.focus}
                                        </div>
                                        <div className="mt-2 text-sm leading-relaxed text-slate-600">
                                            {window.rationale}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AdvisorActionCard>

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
            </div>
        );
    }

    return (
        <AdvisorLandedTabStatePanel
            {...props}
            title={copy.title}
            subtitle={
                locale === 'ko'
                    ? '이 탭은 현재 crop state의 수확 전망과 시장 가격 스냅샷을 함께 해석하는 수확/가격 advisor 영역입니다.'
                    : 'This tab interprets near-term harvest outlook together with the current produce-price snapshot.'
            }
            notes={locale === 'ko'
                ? [
                    '예상 출력: 수확 창, 가격 watchlist, 출하/품질 tradeoff 힌트.',
                    copy.availableButNotRun,
                ]
                : [
                    'Expected outputs: harvest windows, a price watchlist, and shipment/quality tradeoff hints.',
                    copy.availableButNotRun,
                ]}
        />
    );
};

export default HarvestMarketTab;
