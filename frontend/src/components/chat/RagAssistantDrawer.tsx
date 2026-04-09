import { useEffect, useMemo, useState } from 'react';
import { Search, X, BookOpenText } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import type { CropType } from '../../types';
import { getCropLabel, getLocalizedTokenLabel } from '../../utils/displayCopy';
import {
    useRagAssistant,
    type RagAssistantFilters,
} from '../../hooks/useRagAssistant';

interface RagAssistantDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    crop: CropType;
    stacked?: boolean;
    request?: RagAssistantOpenRequest | null;
}

export type RagAssistantPresetKey =
    | 'general'
    | 'environment'
    | 'physiology'
    | 'pesticide'
    | 'nutrient';

export interface RagAssistantOpenRequest {
    nonce: number;
    preset?: RagAssistantPresetKey;
    query?: string;
    autoRun?: boolean;
    source?: 'advisor' | 'assistant' | 'dashboard';
}

interface PresetDefinition {
    key: RagAssistantPresetKey;
    label: string;
    description: string;
    placeholder: string;
    suggestion: string;
    filters?: RagAssistantFilters;
}

function prettifyKnowledgeLabel(value: string, locale: 'ko' | 'en'): string {
    const key = value.trim().toLowerCase();
    const koLabels: Record<string, string> = {
        pesticide_workbook: '농약 워크북',
        nutrient_workbook: '양액 워크북',
        telemetry: '환경 로그',
        pdf: 'PDF 문서',
        xlsx: '엑셀 문서',
        csv: 'CSV 로그',
        environment: '환경',
        physiology: '생리',
        disease_pest: '병해충',
        nutrient_recipe: '양액 처방',
        drain_feedback: '배액 피드백',
        fertilizer: '비료',
        source_water: '원수',
        drain_water: '배액',
        environment_control: '환경 제어',
        cultivation_work: '재배 작업',
        symptom_to_action: '증상 진단',
    };

    const enLabels: Record<string, string> = {
        pesticide_workbook: 'Pesticide workbook',
        nutrient_workbook: 'Nutrient workbook',
        telemetry: 'Telemetry log',
        pdf: 'PDF document',
        xlsx: 'Excel workbook',
        csv: 'CSV log',
        environment: 'Environment',
        physiology: 'Physiology',
        disease_pest: 'Disease / pest',
        nutrient_recipe: 'Nutrient recipe',
        drain_feedback: 'Drain feedback',
        fertilizer: 'Fertilizer',
        source_water: 'Source water',
        drain_water: 'Drain water',
        environment_control: 'Environment control',
        cultivation_work: 'Cultivation work',
        symptom_to_action: 'Symptom diagnosis',
    };

    const labels = locale === 'ko' ? koLabels : enLabels;
    if (labels[key]) {
        return labels[key];
    }

    return value.replace(/_/g, ' ');
}

function prettifyKnowledgeScope(
    value: string,
    locale: 'ko' | 'en',
): string {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'tomato') {
        return locale === 'ko' ? '토마토' : 'Tomato';
    }
    if (normalized === 'cucumber') {
        return locale === 'ko' ? '오이' : 'Cucumber';
    }
    if (normalized === 'all') {
        return locale === 'ko' ? '전체 작물' : 'All crops';
    }
    return prettifyKnowledgeLabel(value, locale);
}

const RagAssistantDrawer = ({
    isOpen,
    onClose,
    crop,
    stacked = false,
    request = null,
}: RagAssistantDrawerProps) => {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            title: '자료 찾기',
            subtitle:
                '현재 작물과 선택한 범위에 맞춰 문서와 워크북 내용을 바로 찾습니다.',
            placeholder: `${cropLabel} 재배 자료를 검색하세요`,
            search: '검색',
            close: '닫기',
            noResults: '일치하는 자료를 찾지 못했습니다. 검색어를 더 구체적으로 바꿔보세요.',
            loading: '자료를 찾는 중...',
            resultCount: '검색 결과',
            limitLabel: '표시 개수',
            topicLabel: '주제',
            sourceLabel: '출처 유형',
            scopeLabel: '검색 범위',
            reset: '초기화',
            idle: '추천 검색어나 직접 입력으로 필요한 자료를 바로 찾을 수 있습니다.',
            ready: '자료 검색 가능',
            unavailable: '자료 준비가 아직 끝나지 않았습니다.',
            databaseMissing:
                '자료를 정리 중입니다. 잠시 후 다시 시도해 주세요.',
            searchModeLabel: '검색 방식',
            routedIntentLabel: '자동 분류',
            appliedScopeLabel: '적용 범위',
            sourceLocatorLabel: '문서 위치',
            sourceOpenLabel: '열기 위치',
            requestSourceAdvisor: '권장 도우미',
            requestSourceAssistant: '질문하기',
            requestSourceDashboard: '대시보드',
            recommendedQueryLabel: '바로 찾기',
            recommendedScopeHint: '추천 범위를 눌러 필요한 자료를 바로 찾을 수 있습니다.',
        }
        : {
            title: 'Find materials',
            subtitle:
                'Search crop-matched documents and workbooks in one place.',
            placeholder: `Search ${cropLabel} materials`,
            search: 'Search',
            close: 'Close',
            noResults: 'No matching materials were found. Try a more specific query.',
            loading: 'Searching materials...',
            resultCount: 'Results',
            limitLabel: 'Limit',
            topicLabel: 'Topic',
            sourceLabel: 'Source type',
            scopeLabel: 'Scope',
            reset: 'Reset',
            idle: 'Use a suggested query or type your own question to find the right material.',
            ready: 'Materials are ready to search',
            unavailable: 'Materials are not ready yet.',
            databaseMissing:
                'Materials are still being prepared. Try again shortly.',
            searchModeLabel: 'Search mode',
            routedIntentLabel: 'Auto-routed to',
            appliedScopeLabel: 'Applied scope',
            sourceLocatorLabel: 'Source location',
            sourceOpenLabel: 'Opened from',
            requestSourceAdvisor: 'Advisor',
            requestSourceAssistant: 'Ask',
            requestSourceDashboard: 'Dashboard',
            recommendedQueryLabel: 'Suggested query',
            recommendedScopeHint: 'Tap a suggested scope to run a focused search immediately.',
        };

    const presets = useMemo<PresetDefinition[]>(() => [
        {
            key: 'general',
            label: locale === 'ko' ? '일반' : 'General',
            description: locale === 'ko' ? '전체 자료를 대상으로 검색합니다.' : 'Search across all indexed materials.',
            placeholder: copy.placeholder,
            suggestion: locale === 'ko' ? `${cropLabel} 생육 관리 핵심을 요약해줘` : `Summarize the main cultivation guidance for ${cropLabel}`,
        },
        {
            key: 'environment',
            label: locale === 'ko' ? '환경' : 'Environment',
            description: locale === 'ko' ? '환경 제어와 VPD/온습도 관련 지식을 우선 조회합니다.' : 'Prioritize environment control and VPD/temperature/humidity guidance.',
            placeholder: locale === 'ko' ? `${cropLabel} VPD 관리 포인트` : `${cropLabel} VPD management guidance`,
            suggestion: locale === 'ko' ? `${cropLabel} VPD 관리 포인트` : `${cropLabel} VPD management guidance`,
            filters: {
                source_types: ['pdf', 'csv'],
                topic_major: 'environment',
            },
        },
        {
            key: 'physiology',
            label: locale === 'ko' ? '생리' : 'Physiology',
            description: locale === 'ko' ? '생리 반응, 생육 진단, 장애 관련 지식을 우선 조회합니다.' : 'Prioritize physiology, diagnosis, and crop-balance guidance.',
            placeholder: locale === 'ko' ? `${cropLabel} 생육 진단 기준` : `${cropLabel} physiology diagnosis criteria`,
            suggestion: locale === 'ko' ? `${cropLabel} 생육 진단 기준` : `${cropLabel} physiology diagnosis criteria`,
            filters: {
                source_types: ['pdf'],
                topic_major: 'physiology',
            },
        },
        {
            key: 'pesticide',
            label: locale === 'ko' ? '농약' : 'Pesticide',
            description: locale === 'ko' ? '병해충, 제품, 교호 전략 관련 워크북을 우선 조회합니다.' : 'Prioritize pesticide workbook rows for disease/pest and rotation guidance.',
            placeholder: locale === 'ko' ? `${cropLabel} 흰가루병 교호 추천` : `${cropLabel} powdery mildew rotation`,
            suggestion: locale === 'ko' ? `${cropLabel} 흰가루병 교호 추천` : `${cropLabel} powdery mildew rotation`,
            filters: {
                source_types: ['xlsx'],
                asset_families: ['pesticide_workbook'],
            },
        },
        {
            key: 'nutrient',
            label: locale === 'ko' ? '양액' : 'Nutrient',
            description: locale === 'ko' ? '레시피, 원수, 배액, 비료 관련 워크북을 우선 조회합니다.' : 'Prioritize nutrient workbook rows for recipes, water, and fertilizer guidance.',
            placeholder: locale === 'ko' ? `${cropLabel} 양액 경계 조건 기준` : `${cropLabel} nutrient guardrail guidance`,
            suggestion: locale === 'ko' ? `${cropLabel} 양액 경계 조건 기준` : `${cropLabel} nutrient guardrail guidance`,
            filters: {
                source_types: ['xlsx'],
                asset_families: ['nutrient_workbook'],
            },
        },
    ], [copy.placeholder, cropLabel, locale]);

    const presetMap = useMemo(
        () =>
            new Map<RagAssistantPresetKey, PresetDefinition>(
                presets.map((preset) => [preset.key, preset]),
            ),
        [presets],
    );
    const initialPresetKey =
        (request?.preset && presetMap.has(request.preset) ? request.preset : undefined) ?? 'general';
    const initialPreset = presetMap.get(initialPresetKey) ?? presets[0];
    const initialQuery = request?.query?.trim() || initialPreset.suggestion;
    const initialLimit = 6;
    const [activePresetKey, setActivePresetKey] = useState<RagAssistantPresetKey>(initialPresetKey);
    const [input, setInput] = useState(initialQuery);
    const [limit, setLimit] = useState(initialLimit);
    const {
        results,
        loading,
        error,
        lastQuery,
        lastQueryMode,
        queryStatus,
        databaseStatus,
        returnedCount,
        resolvedScope,
        appliedFilters,
        routing,
        runSearch,
        clear,
    } = useRagAssistant();

    const activePreset = presetMap.get(activePresetKey) ?? initialPreset;

    useEffect(() => {
        if (!isOpen || !request || request.autoRun === false) {
            return;
        }

        void runSearch({
            crop,
            query: initialQuery,
            limit: initialLimit,
            filters: initialPreset.filters,
        });
    }, [crop, initialLimit, initialPreset.filters, initialQuery, isOpen, request, runSearch]);

    async function handleSearch() {
        if (!input.trim()) {
            return;
        }

        await runSearch({
            crop,
            query: input,
            limit,
            filters: activePreset.filters,
        });
    }

    function handlePresetChange(nextPresetKey: RagAssistantPresetKey) {
        const nextPreset = presetMap.get(nextPresetKey) ?? presets[0];
        const shouldReplaceQuery =
            !input.trim() || input.trim() === activePreset.suggestion.trim();
        setActivePresetKey(nextPresetKey);
        if (shouldReplaceQuery) {
            setInput(nextPreset.suggestion);
        }
    }

    function handleReset() {
        setActivePresetKey('general');
        setInput((presetMap.get('general') ?? presets[0]).suggestion);
        setLimit(initialLimit);
        clear();
    }

    if (!isOpen) {
        return null;
    }

    const sidePositionClass = stacked ? 'md:right-[26rem]' : 'md:right-6';
    const requestSourceLabel = request?.source
        ? {
            advisor: copy.requestSourceAdvisor,
            assistant: copy.requestSourceAssistant,
            dashboard: copy.requestSourceDashboard,
        }[request.source]
        : null;
    const routedIntentLabel = routing?.intent
        ? prettifyKnowledgeLabel(routing.intent, locale)
        : null;
    const routedSubIntentLabel = routing?.sub_intent
        ? prettifyKnowledgeLabel(routing.sub_intent, locale)
        : null;
    const appliedScopeLabels = [
        ...(appliedFilters.asset_families ?? []).map((value) =>
            prettifyKnowledgeLabel(value, locale),
        ),
        ...(appliedFilters.source_types ?? []).map((value) =>
            prettifyKnowledgeLabel(value, locale),
        ),
        ...(appliedFilters.topic_major ? [prettifyKnowledgeLabel(appliedFilters.topic_major, locale)] : []),
        ...(appliedFilters.topic_minor ? [prettifyKnowledgeLabel(appliedFilters.topic_minor, locale)] : []),
    ];

    return (
        <div
            className={`fixed bottom-6 left-4 right-4 z-50 flex h-[560px] flex-col overflow-hidden rounded-2xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] shadow-[0_28px_64px_rgba(103,71,54,0.28)] md:left-auto md:w-[420px] ${sidePositionClass}`.trim()}
        >
            <div className="flex items-center justify-between bg-[linear-gradient(135deg,#5a2f23,#7a4334)] p-4 text-white">
                <div className="flex items-center gap-2">
                    <BookOpenText className="h-5 w-5 text-[color:var(--sg-accent-harvest-soft)]" />
                    <span className="font-medium">{copy.title}</span>
                </div>
                <button
                    onClick={onClose}
                    aria-label={copy.close}
                    title={copy.close}
                    className="text-white/70 hover:text-white"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="border-b border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-accent-earth-soft)] px-4 py-3">
                <p className="text-xs leading-relaxed text-[color:var(--sg-accent-earth)]">{copy.subtitle}</p>
                <p className="mt-2 text-[11px] font-medium text-[color:var(--sg-accent-earth)]">
                    {databaseStatus === 'ready'
                        ? copy.ready
                        : databaseStatus === 'missing'
                          ? copy.unavailable
                          : copy.idle}
                </p>
                {requestSourceLabel ? (
                    <p className="mt-1 text-[11px] text-[color:var(--sg-accent-earth)]">
                        {copy.sourceOpenLabel}: {requestSourceLabel}
                    </p>
                ) : null}
            </div>

            <div className="border-b border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-4 py-3">
                <div className="mb-3 rounded-2xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-muted)]">
                        {copy.recommendedQueryLabel}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[color:var(--sg-text-muted)]">
                        {copy.recommendedScopeHint}
                    </p>
                    <button
                        type="button"
                        onClick={() => setInput(activePreset.suggestion)}
                        disabled={loading}
                        className="mt-3 rounded-full border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--sg-accent-earth)] hover:bg-[color:var(--sg-accent-earth-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {activePreset.suggestion}
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {presets.map((preset) => (
                        <button
                            key={preset.key}
                            type="button"
                            onClick={() => handlePresetChange(preset.key)}
                            disabled={loading}
                            className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                                preset.key === activePresetKey
                                    ? 'border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-accent-earth-soft)] text-[color:var(--sg-accent-earth)]'
                                    : 'border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] text-[color:var(--sg-text-strong)] hover:bg-[color:var(--sg-accent-earth-soft)]/70'
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                            <div className="font-semibold">{preset.label}</div>
                            <div className="mt-1 leading-relaxed text-[11px] opacity-80">
                                {preset.description}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="border-b border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-4 py-3">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        disabled={loading}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !loading) {
                                void handleSearch();
                            }
                        }}
                        placeholder={activePreset.placeholder}
                        className="flex-1 rounded-full border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] px-4 py-2 text-sm text-[color:var(--sg-text-strong)] focus:border-[color:var(--sg-accent-earth)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <select
                        value={limit}
                        disabled={loading}
                        onChange={(event) => setLimit(Number(event.target.value))}
                        className="rounded-full border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-3 py-2 text-xs font-medium text-[color:var(--sg-text-strong)] focus:border-[color:var(--sg-accent-earth)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={copy.limitLabel}
                    >
                        {[4, 6, 8, 10].map((value) => (
                            <option key={value} value={value}>
                                {copy.limitLabel} {value}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => void handleSearch()}
                        disabled={loading}
                        aria-label={copy.search}
                        title={copy.search}
                        className="rounded-full bg-[linear-gradient(135deg,var(--sg-accent-earth),#c45d47)] p-2 text-white shadow-[var(--sg-shadow-card)] hover:brightness-[1.04] disabled:opacity-50"
                    >
                        <Search className="h-4 w-4" />
                    </button>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--sg-text-muted)]">
                    <span>
                        {copy.scopeLabel}: {activePreset.label}
                    </span>
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={loading}
                        className="font-medium text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {copy.reset}
                    </button>
                </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[color:var(--sg-surface-warm)] p-4">
                {loading ? (
                    <div className="rounded-xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-4 text-sm text-[color:var(--sg-text-muted)]">
                        {copy.loading}
                    </div>
                ) : null}

                {!loading && error ? (
                    <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}

                {!loading && !error && lastQuery ? (
                    <div className="rounded-xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-4">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--sg-text-muted)]">
                            <span>{copy.resultCount}: {returnedCount}</span>
                            {lastQueryMode ? (
                                <span className="rounded-full bg-[color:var(--sg-surface-warm)] px-2 py-1 normal-case tracking-normal text-[color:var(--sg-text-strong)]">
                                    {copy.searchModeLabel}: {getLocalizedTokenLabel(lastQueryMode, locale)}
                                </span>
                            ) : null}
                            {routedIntentLabel ? (
                                <span className="rounded-full bg-[color:var(--sg-surface-warm)] px-2 py-1 normal-case tracking-normal text-[color:var(--sg-text-strong)]">
                                    {copy.routedIntentLabel}: {routedIntentLabel}
                                    {routedSubIntentLabel ? ` / ${routedSubIntentLabel}` : ''}
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--sg-text-strong)]">{lastQuery}</p>
                        {appliedScopeLabels.length > 0 || resolvedScope ? (
                            <p className="mt-2 text-xs leading-relaxed text-[color:var(--sg-text-muted)]">
                                {copy.appliedScopeLabel}:{' '}
                                {[...appliedScopeLabels, resolvedScope ? prettifyKnowledgeScope(resolvedScope, locale) : null]
                                    .filter((value): value is string => Boolean(value))
                                    .join(' · ')}
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {!loading && !error && lastQuery && results.length === 0 ? (
                    <div className="rounded-xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-4 text-sm text-[color:var(--sg-text-muted)]">
                        {queryStatus === 'database_missing' ? copy.databaseMissing : copy.noResults}
                    </div>
                ) : null}

                {results.map((result) => (
                    <article
                        key={`${result.document.relative_path}-${result.source_locator ?? result.document.filename}-${result.score}`}
                        className="rounded-xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-4 shadow-sm"
                    >
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[color:var(--sg-accent-earth-soft)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--sg-accent-earth)]">
                                {prettifyKnowledgeLabel(result.document.asset_family, locale)}
                            </span>
                            <span className="rounded-full bg-[color:var(--sg-surface-warm)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--sg-text-strong)]">
                                {copy.sourceLabel}: {prettifyKnowledgeLabel(result.document.source_type, locale)}
                            </span>
                            {result.topic_major ? (
                                <span className="rounded-full bg-[color:var(--sg-surface-warm)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--sg-text-strong)]">
                                    {copy.topicLabel}: {prettifyKnowledgeLabel(result.topic_major, locale)}
                                    {result.topic_minor ? ` / ${prettifyKnowledgeLabel(result.topic_minor, locale)}` : ''}
                                </span>
                            ) : null}
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                            {result.document.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--sg-text-strong)]">
                            {result.text}
                        </p>
                        {result.source_locator ? (
                            <p className="mt-3 text-xs text-[color:var(--sg-text-muted)]">
                                {copy.sourceLocatorLabel}: {result.source_locator}
                            </p>
                        ) : null}
                    </article>
                ))}
            </div>
        </div>
    );
};

export default RagAssistantDrawer;
