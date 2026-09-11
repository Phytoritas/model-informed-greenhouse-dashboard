import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronRight, FileText, Search } from 'lucide-react';
import type { CropType } from '../../types';
import { useRagAssistant } from '../../hooks/useRagAssistant';
import DashboardCard from '../common/DashboardCard';
import ScientificText from '../common/ScientificText';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface AskKnowledgeBoardProps {
    locale: 'ko' | 'en';
    crop: CropType;
    cropLabel: string;
    query: string;
    onQueryChange: (query: string) => void;
    searchRequest: { query?: string; nonce: number; autoRun?: boolean } | null;
}

function formatScopeLabel(scope: string | null, locale: 'ko' | 'en') {
    if (!scope) {
        return null;
    }
    if (scope === 'all') {
        return locale === 'ko' ? '전체 작물' : 'All crops';
    }
    if (scope === 'cucumber') return locale === 'ko' ? '오이' : 'Cucumber';
    if (scope === 'tomato') return locale === 'ko' ? '토마토' : 'Tomato';
    return scope;
}

export default function AskKnowledgeBoard({
    locale,
    crop,
    cropLabel,
    query,
    onQueryChange,
    searchRequest,
}: AskKnowledgeBoardProps) {
    const copy = locale === 'ko'
        ? {
            eyebrow: '재배 참고 자료',
            title: '자료 찾기',
            description: '질문과 관련된 문헌의 본문과 원문 위치를 확인하세요.',
            placeholder: `${cropLabel} 자료를 찾거나 질문 형태로 검색어를 입력하세요`,
            search: '자료 찾기',
            idle: '검색어를 입력하면 이 화면 아래에 바로 관련 자료가 나타납니다.',
            loading: '자료를 찾는 중입니다.',
            noResults: '일치하는 자료가 없습니다. 검색어를 더 구체적으로 바꿔보세요.',
            results: '찾은 자료',
            query: '검색어',
            scope: '적용 범위',
            count: '결과 수',
            openFrom: '자료 위치',
            toc: '자료 목차',
            page: '검색 결과',
            previous: '이전 결과',
            next: '다음 결과',
            score: '관련도',
            pageGuide: '자료를 선택하면 검색된 본문과 원문 위치를 보여줍니다.',
            unavailable: '자료 검색을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
        }
        : {
            eyebrow: 'Search inside this page',
            title: 'Find source material inside the assistant page',
            description: 'Search and read the linked material directly here without opening a separate panel.',
            placeholder: `Search ${cropLabel} materials or type a question-shaped query`,
            search: 'Find materials',
            idle: 'Enter a query and the related material will appear below in this page.',
            loading: 'Searching materials...',
            noResults: 'No matching material was found. Try a more specific query.',
            results: 'Materials found',
            query: 'Query',
            scope: 'Scope',
            count: 'Results',
            openFrom: 'Source location',
            toc: 'Table of contents',
            page: 'Result',
            previous: 'Previous result',
            next: 'Next result',
            score: 'Relevance',
            pageGuide: 'Select a result to read its excerpt and original source location.',
            unavailable: 'Reference search is unavailable. Please retry shortly.',
        };
    const [activeIndex, setActiveIndex] = useState(0);
    const handledRequestRef = useRef<number | null>(null);
    const {
        results,
        loading,
        error,
        lastQuery,
        returnedCount,
        resolvedScope,
        queryStatus,
        databaseStatus,
        runSearch,
        clear,
    } = useRagAssistant();

    useEffect(() => {
        clear();
        setActiveIndex(0);
    }, [crop, clear]);

    useEffect(() => {
        if (!searchRequest?.query?.trim() || searchRequest.autoRun === false || handledRequestRef.current === searchRequest.nonce) {
            return;
        }
        // Let StrictMode finish its setup/cleanup replay before consuming the seed.
        const timer = window.setTimeout(() => {
            handledRequestRef.current = searchRequest.nonce;
            void runSearch({
                crop,
                query: searchRequest.query,
                limit: 4,
            });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [crop, runSearch, searchRequest?.nonce, searchRequest?.query, searchRequest?.autoRun]);

    async function handleSearch() {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) {
            return;
        }
        setActiveIndex(0);
        await runSearch({
            crop,
            query: normalizedQuery,
            limit: 4,
        });
    }

    function handleQueryInputChange(value: string) {
        onQueryChange(value);
        if (lastQuery && value.trim() !== lastQuery) {
            setActiveIndex(0);
            clear();
        }
    }

    const resolvedScopeLabel = formatScopeLabel(resolvedScope, locale);
    const activePageIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));
    const activeResult = results[activePageIndex] ?? null;
    const tocEntries = useMemo(
        () => results.map((item, index) => ({
            key: `${item.document.relative_path}-${item.score}-${index}`,
            title: item.document.title,
            topic: item.topic_minor ?? item.topic_major ?? item.document.asset_family,
            locator: item.source_locator,
        })),
        [results],
    );

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            variant="scenario"
            actions={(
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={handleSearch}>
                        <Search className="h-4 w-4" />
                        {copy.search}
                    </Button>
                </div>
            )}
        >
            <div className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                        aria-label={copy.placeholder}
                        placeholder={copy.placeholder}
                        value={query}
                        onChange={(event) => handleQueryInputChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleSearch();
                            }
                        }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        {lastQuery ? <Badge variant="forest">{`${copy.query}: ${lastQuery}`}</Badge> : null}
                        {resolvedScopeLabel ? <Badge variant="blue">{`${copy.scope}: ${resolvedScopeLabel}`}</Badge> : null}
                        {lastQuery ? <Badge variant="amber">{`${copy.count}: ${returnedCount}`}</Badge> : null}
                    </div>
                </div>

                {loading ? (
                    <div className="sg-panel px-4 py-4 text-sm text-[color:var(--sg-text-muted)]">
                        {copy.loading}
                    </div>
                ) : error || queryStatus === 'database_missing' || queryStatus === 'retrieval_unavailable' || databaseStatus === 'missing' ? (
                    <div className="sg-panel border-[color:var(--sg-status-offline-text)]/25 bg-[color:var(--sg-status-offline-bg)] px-4 py-4 text-sm text-[color:var(--sg-status-offline-text)]">
                        {copy.unavailable}
                    </div>
                ) : results.length > 0 && activeResult ? (
                    <div className="space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <div className="sg-eyebrow">{copy.results}</div>
                                <p className="mt-1 text-sm text-[color:var(--sg-text-muted)]">
                                    {copy.pageGuide}
                                </p>
                            </div>
                            <Badge variant="forest">{`${copy.page} ${activePageIndex + 1}/${results.length}`}</Badge>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                            <nav
                                aria-label={copy.toc}
                                className="sg-panel bg-[color:var(--sg-color-ivory)] p-3"
                            >
                                <div className="flex items-center gap-2 px-2 pb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-color-olive)]">
                                    <BookOpen className="h-4 w-4" />
                                    {copy.toc}
                                </div>
                                <div className="space-y-2">
                                    {tocEntries.map((entry, index) => {
                                        const selected = index === activePageIndex;
                                        return (
                                            <button
                                                key={entry.key}
                                                type="button"
                                                onClick={() => setActiveIndex(index)}
                                                className={`w-full rounded-[var(--sg-radius-md)] px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-color-primary)] ${selected ? 'bg-[color:var(--sg-surface-strong)] text-[color:var(--sg-text-strong)]' : 'bg-[color:var(--sg-surface-warm)] text-[color:var(--sg-text-muted)] hover:bg-[color:var(--sg-surface-strong)]'}`}
                                                aria-current={selected ? 'page' : undefined}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-semibold text-[color:var(--sg-color-olive)]">
                                                        {copy.page} {index + 1}
                                                    </span>
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="mt-1 line-clamp-2 text-sm font-semibold leading-6">
                                                    {entry.title}
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    <Badge variant="forest">{entry.topic}</Badge>
                                                    {entry.locator ? <Badge variant="muted">{entry.locator}</Badge> : null}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </nav>
                            <article
                                className="sg-panel min-w-0 px-4 py-4 sm:px-5 sm:py-5"
                            >
                                <div className="mt-4 flex items-start gap-3">
                                    <div className="rounded-[var(--sg-radius-md)] bg-[color:var(--sg-color-sage-soft)] p-2 text-[color:var(--sg-color-olive)]">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                            {activeResult.source_locator || `${copy.page} ${activePageIndex + 1}`}
                                        </div>
                                        <h3 className="mt-1 text-base font-semibold leading-snug text-[color:var(--sg-text-strong)]">
                                            {activeResult.document.title}
                                        </h3>
                                    </div>
                                </div>
                                {/* Retrieved passage: same 15px/1.85 as an assistant
                                    answer, since both are long Korean prose read in
                                    the same workspace. The text stays verbatim. */}
                                <p className="mt-4 whitespace-pre-line break-words text-[15px] leading-[1.85] text-[color:var(--sg-text)]">
                                    <ScientificText text={activeResult.text} />
                                </p>
                                {/* A long unbroken repository path would otherwise
                                    push the card past a 390px viewport. */}
                                <div className="mt-4 grid min-w-0 gap-2 rounded-[var(--sg-radius-lg)] bg-[color:var(--sg-color-ivory)] px-3 py-3 text-[13px] leading-6 text-[color:var(--sg-text-muted)] sm:grid-cols-2">
                                    <div className="min-w-0 break-words">{copy.openFrom}: {activeResult.document.relative_path}</div>
                                    {activeResult.source_locator ? <div className="min-w-0 break-words">{activeResult.source_locator}</div> : null}
                                </div>
                                <div className="mt-4 flex flex-wrap justify-between gap-2">
                                    <Button
                                        variant="secondary"
                                        disabled={activePageIndex === 0}
                                        onClick={() => setActiveIndex(Math.max(0, activePageIndex - 1))}
                                    >
                                        {copy.previous}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        disabled={activePageIndex >= results.length - 1}
                                        onClick={() => setActiveIndex(Math.min(results.length - 1, activePageIndex + 1))}
                                    >
                                        {copy.next}
                                    </Button>
                                </div>
                            </article>
                        </div>
                    </div>
                ) : (
                    <div className="sg-panel px-4 py-4 text-sm text-[color:var(--sg-text-muted)]">
                        {lastQuery ? copy.noResults : copy.idle}
                    </div>
                )}
            </div>
        </DashboardCard>
    );
}
