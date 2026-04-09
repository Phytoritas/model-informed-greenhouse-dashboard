import { useEffect } from 'react';
import { Search } from 'lucide-react';
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
            eyebrow: '페이지 안에서 자료 찾기',
            title: '질문 흐름 안에서 바로 자료를 찾습니다',
            description: '별도 패널을 열지 않고 이 화면에서 바로 검색하고 관련 문서를 읽을 수 있습니다.',
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
        };
    const {
        results,
        loading,
        error,
        lastQuery,
        returnedCount,
        resolvedScope,
        runSearch,
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
        await runSearch({
            crop,
            query: normalizedQuery,
            limit: 4,
        });
    }

    const resolvedScopeLabel = formatScopeLabel(resolvedScope, locale, cropLabel);

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
                        onChange={(event) => onQueryChange(event.target.value)}
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
                ) : results.length > 0 ? (
                    <div className="space-y-3">
                        <div className="sg-eyebrow">{copy.results}</div>
                        <div className="grid gap-3">
                            {results.map((item) => (
                                <article
                                    key={`${item.document.relative_path}-${item.score}`}
                                    className="rounded-[24px] bg-white/86 px-4 py-4"
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="default">{item.document.source_type}</Badge>
                                        {item.topic_major ? <Badge variant="muted">{item.topic_major}</Badge> : null}
                                    </div>
                                    <div className="mt-3 text-base font-semibold text-[color:var(--sg-text-strong)]">
                                        {item.document.title}
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                                        {item.text}
                                    </p>
                                    <div className="mt-3 text-xs text-[color:var(--sg-text-faint)]">
                                        {copy.openFrom}: {item.document.relative_path}
                                    </div>
                                </article>
                            ))}
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
