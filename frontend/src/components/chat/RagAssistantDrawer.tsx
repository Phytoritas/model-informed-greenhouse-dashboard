import { useState } from 'react';
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
}

type PresetKey =
    | 'general'
    | 'environment'
    | 'physiology'
    | 'pesticide'
    | 'nutrient';

interface PresetDefinition {
    key: PresetKey;
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
    };

    const labels = locale === 'ko' ? koLabels : enLabels;
    if (labels[key]) {
        return labels[key];
    }

    return value.replace(/_/g, ' ');
}

const RagAssistantDrawer = ({
    isOpen,
    onClose,
    crop,
    stacked = false,
}: RagAssistantDrawerProps) => {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            title: '지식 검색',
            subtitle:
                '문서와 워크북에서 관련 지식만 조회합니다. 아직 최종 응답에 자동 반영되지는 않습니다.',
            placeholder: `${cropLabel} 재배 지식을 검색하세요`,
            search: '검색',
            close: '닫기',
            route: '지식 경로',
            queryMode: '검색 방식',
            routeValue: '지식 검색 API',
            noResults: '일치하는 지식 조각을 찾지 못했습니다. 검색어를 더 구체적으로 바꿔보세요.',
            loading: '지식 조각을 검색하는 중...',
            resultCount: '검색 결과',
            limitLabel: '표시 개수',
            topicLabel: '주제',
            sourceLabel: '출처 유형',
            scopeLabel: '검색 범위',
            reset: '초기화',
            idle: '검색을 실행하면 지식 DB 상태를 확인합니다.',
            ready: '지식 DB 검색 가능',
            unavailable: '지식 DB가 아직 준비되지 않았습니다.',
            databaseMissing:
                '지식 DB가 아직 준비되지 않았습니다. `/api/knowledge/reindex` 이후 다시 시도하세요.',
        }
        : {
            title: 'RAG Knowledge Search',
            subtitle:
                'This searches documents and workbooks directly. Results are not auto-injected into the AI finalizer yet.',
            placeholder: `Search ${cropLabel} knowledge`,
            search: 'Search',
            close: 'Close',
            route: 'knowledge route',
            queryMode: 'retrieval mode',
            routeValue: 'Knowledge query API',
            noResults: 'No matching knowledge chunks were found. Try a more specific query.',
            loading: 'Searching persisted knowledge chunks...',
            resultCount: 'Results',
            limitLabel: 'Limit',
            topicLabel: 'Topic',
            sourceLabel: 'Source type',
            scopeLabel: 'Scope',
            reset: 'Reset',
            idle: 'Run a query to inspect the current knowledge DB status.',
            ready: 'Knowledge DB is query-ready',
            unavailable: 'Knowledge DB is not ready yet.',
            databaseMissing:
                'The knowledge DB is not ready yet. Rebuild it through `/api/knowledge/reindex` and try again.',
        };

    const presets: PresetDefinition[] = [
        {
            key: 'general',
            label: locale === 'ko' ? '일반' : 'General',
            description: locale === 'ko' ? '전체 지식 자산을 대상으로 검색합니다.' : 'Search across all indexed knowledge assets.',
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
    ];

    const [activePresetKey, setActivePresetKey] = useState<PresetKey>('general');
    const [input, setInput] = useState('');
    const [limit, setLimit] = useState(6);
    const {
        results,
        loading,
        error,
        lastQuery,
        lastQueryMode,
        queryStatus,
        databaseStatus,
        returnedCount,
        runSearch,
        clear,
    } = useRagAssistant();

    const activePreset =
        presets.find((preset) => preset.key === activePresetKey) ?? presets[0];

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

    function handlePresetChange(nextPresetKey: PresetKey) {
        const nextPreset =
            presets.find((preset) => preset.key === nextPresetKey) ?? presets[0];
        setActivePresetKey(nextPresetKey);
        if (!input.trim()) {
            setInput(nextPreset.suggestion);
        }
    }

    function handleReset() {
        setActivePresetKey('general');
        setInput('');
        setLimit(6);
        clear();
    }

    if (!isOpen) {
        return null;
    }

    const sidePositionClass = stacked ? 'md:right-[26rem]' : 'md:right-6';

    return (
        <div
            className={`fixed bottom-6 left-4 right-4 z-50 flex h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:left-auto md:w-[420px] ${sidePositionClass}`.trim()}
        >
            <div className="flex items-center justify-between bg-slate-900 p-4 text-white">
                <div className="flex items-center gap-2">
                    <BookOpenText className="h-5 w-5 text-emerald-400" />
                    <span className="font-medium">{copy.title}</span>
                </div>
                <button
                    onClick={onClose}
                    aria-label={copy.close}
                    title={copy.close}
                    className="text-slate-300 hover:text-white"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs leading-relaxed text-emerald-900">{copy.subtitle}</p>
                <p className="mt-2 text-[11px] font-medium text-emerald-800">
                    {databaseStatus === 'ready'
                        ? copy.ready
                        : databaseStatus === 'missing'
                          ? copy.unavailable
                          : copy.idle}
                </p>
            </div>

            <div className="border-b border-slate-100 bg-white px-4 py-3">
                <div className="grid grid-cols-2 gap-2">
                    {presets.map((preset) => (
                        <button
                            key={preset.key}
                            type="button"
                            onClick={() => handlePresetChange(preset.key)}
                            disabled={loading}
                            className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                                preset.key === activePresetKey
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                            <div className="font-semibold">{preset.label}</div>
                            <div className="mt-1 leading-relaxed text-[11px] opacity-80">
                                {preset.description}
                            </div>
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => setInput(activePreset.suggestion)}
                    disabled={loading}
                    className="mt-3 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {activePreset.suggestion}
                </button>
            </div>

            <div className="border-b border-slate-100 bg-white px-4 py-3">
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
                        className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <select
                        value={limit}
                        disabled={loading}
                        onChange={(event) => setLimit(Number(event.target.value))}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
                        className="rounded-full bg-emerald-600 p-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <Search className="h-4 w-4" />
                    </button>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                        {copy.scopeLabel}: {activePreset.label}
                    </span>
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={loading}
                        className="font-medium text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {copy.reset}
                    </button>
                </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                {loading ? (
                    <div className="rounded-xl border border-emerald-100 bg-white p-4 text-sm text-slate-600">
                        {copy.loading}
                    </div>
                ) : null}

                {!loading && error ? (
                    <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}

                {!loading && !error && lastQuery ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                            <span>{copy.resultCount}: {returnedCount}</span>
                            {lastQueryMode ? (
                                <span className="rounded-full bg-slate-100 px-2 py-1 normal-case tracking-normal text-slate-700">
                                    {copy.queryMode}: {getLocalizedTokenLabel(lastQueryMode, locale)}
                                </span>
                            ) : null}
                            <span className="rounded-full bg-slate-100 px-2 py-1 normal-case tracking-normal text-slate-700">
                                {copy.route}: {copy.routeValue}
                            </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{lastQuery}</p>
                    </div>
                ) : null}

                {!loading && !error && lastQuery && results.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        {queryStatus === 'database_missing' ? copy.databaseMissing : copy.noResults}
                    </div>
                ) : null}

                {results.map((result) => (
                    <article
                        key={`${result.document.relative_path}-${result.source_locator ?? result.document.filename}-${result.score}`}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
                                {prettifyKnowledgeLabel(result.document.asset_family, locale)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                {copy.sourceLabel}: {prettifyKnowledgeLabel(result.document.source_type, locale)}
                            </span>
                            {result.topic_major ? (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                    {copy.topicLabel}: {prettifyKnowledgeLabel(result.topic_major, locale)}
                                    {result.topic_minor ? ` / ${prettifyKnowledgeLabel(result.topic_minor, locale)}` : ''}
                                </span>
                            ) : null}
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-slate-900">
                            {result.document.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {result.text}
                        </p>
                    </article>
                ))}
            </div>
        </div>
    );
};

export default RagAssistantDrawer;
