import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronRight, FileText, Search } from 'lucide-react';
import type { CropType } from '../../types';
import { useRagAssistant } from '../../hooks/useRagAssistant';
import DashboardCard from '../common/DashboardCard';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface AskKnowledgeBoardProps {
    locale: 'ko' | 'en';
    crop: CropType;
    cropLabel: string;
    query: string;
    onQueryChange: (query: string) => void;
    searchRequest: { query?: string; nonce: number } | null;
}

function formatScopeLabel(scope: string | null, locale: 'ko' | 'en', cropLabel: string) {
    if (!scope) {
        return null;
    }
    if (scope === 'all') {
        return locale === 'ko' ? '전체 작물' : 'All crops';
    }
    if (scope === 'cucumber' || scope === 'tomato') {
        return cropLabel;
    }
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
            eyebrow: '자료 목차 검색',
            title: '책처럼 넘겨 보는 재배 자료',
            description: '검색어를 입력하면 관련 문서를 목차로 묶고, 선택한 항목을 한 페이지처럼 읽을 수 있습니다.',
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
            page: '페이지',
            previous: '이전 페이지',
            next: '다음 페이지',
            score: '관련도',
            pageGuide: '왼쪽 목차를 누르면 해당 자료 페이지로 이동합니다.',
        }
        : {
            eyebrow: 'Material browser',
            title: 'Read cultivation material like a book',
            description: 'Search source material, use the table of contents, and read the selected result as a page.',
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
            page: 'Page',
            previous: 'Previous page',
            next: 'Next page',
            score: 'Relevance',
            pageGuide: 'Select an entry in the table of contents to read it as a page.',
        };
    const [activeIndex, setActiveIndex] = useState(0);
    const {
        results,
        loading,
        error,
        lastQuery,
        returnedCount,
        resolvedScope,
        runSearch,
        clear,
    } = useRagAssistant();

    useEffect(() => {
        if (!searchRequest?.query?.trim()) {
            return;
        }
        void runSearch({
            crop,
            query: searchRequest.query,
            limit: 4,
        });
    }, [crop, runSearch, searchRequest?.nonce, searchRequest?.query]);

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

    const resolvedScopeLabel = formatScopeLabel(resolvedScope, locale, cropLabel);
    const activePageIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));
    const activeResult = results[activePageIndex] ?? null;
    const tocEntries = useMemo(
        () => results.map((item, index) => ({
            key: `${item.document.relative_path}-${item.score}-${index}`,
            title: item.document.title,
            topic: item.topic_minor ?? item.topic_major ?? item.document.asset_family,
            score: `${Math.round(item.score * 100)}%`,
        })),
        [results],
    );

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            className="sg-tint-neutral"
            actions={(
                <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={handleSearch}>
                        <Search className="h-4 w-4" />
                        {copy.search}
                    </Button>
                </div>
            )}
        >
            <div className="space-y-4">
                <div className="grid gap-3 rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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
                    <div className="rounded-[22px] bg-white/82 px-4 py-4 text-sm text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        {copy.loading}
                    </div>
                ) : error ? (
                    <div className="rounded-[22px] bg-[#fff1ec] px-4 py-4 text-sm text-[#9d4125]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        {error}
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
                                className="rounded-[26px] border border-[color:var(--sg-outline-soft)] bg-[linear-gradient(180deg,rgba(250,247,242,0.98),rgba(232,241,227,0.72))] p-3"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
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
                                                className={`w-full rounded-[18px] px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-color-primary)] ${selected ? 'bg-white text-[color:var(--sg-text-strong)]' : 'bg-white/54 text-[color:var(--sg-text-muted)] hover:bg-white/88'}`}
                                                aria-current={selected ? 'page' : undefined}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-semibold text-[color:var(--sg-color-olive)]">
                                                        {copy.page} {index + 1}
                                                    </span>
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5">
                                                    {entry.title}
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                                                    <span className="rounded-full bg-[color:var(--sg-color-sage-soft)] px-2 py-0.5 text-[color:var(--sg-color-olive)]">
                                                        {entry.topic}
                                                    </span>
                                                    <span className="rounded-full bg-white/86 px-2 py-0.5 text-[color:var(--sg-text-faint)]">
                                                        {entry.score}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </nav>
                            <article
                                className="rounded-[28px] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-4 py-4 sm:px-5 sm:py-5"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="default">{activeResult.document.source_type}</Badge>
                                    {activeResult.topic_major ? <Badge variant="muted">{activeResult.topic_major}</Badge> : null}
                                    {activeResult.chunk_type ? <Badge variant="forest">{activeResult.chunk_type}</Badge> : null}
                                </div>
                                <div className="mt-4 flex items-start gap-3">
                                    <div className="rounded-[18px] bg-[color:var(--sg-color-sage-soft)] p-2 text-[color:var(--sg-color-olive)]">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                            {copy.page} {activePageIndex + 1}
                                        </div>
                                        <h3 className="mt-1 text-lg font-semibold leading-tight text-[color:var(--sg-text-strong)]">
                                            {activeResult.document.title}
                                        </h3>
                                    </div>
                                </div>
                                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[color:var(--sg-text-muted)]">
                                    {activeResult.text}
                                </p>
                                <div className="mt-4 grid gap-2 rounded-[20px] bg-[color:var(--sg-color-ivory)] px-3 py-3 text-xs text-[color:var(--sg-text-muted)] sm:grid-cols-2">
                                    <div>{copy.openFrom}: {activeResult.document.relative_path}</div>
                                    <div>{copy.score}: {Math.round(activeResult.score * 100)}%</div>
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
                    <div className="rounded-[22px] bg-white/82 px-4 py-4 text-sm text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                        {lastQuery ? copy.noResults : copy.idle}
                    </div>
                )}
            </div>
        </DashboardCard>
    );
}
