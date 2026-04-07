import { useRef, useState } from 'react';
import { API_URL } from '../config';
import type { CropType } from '../types';

export interface RagAssistantFilters {
    source_types?: string[];
    asset_families?: string[];
    topic_major?: string;
    topic_minor?: string;
}

export interface RagAssistantResultDocument {
    title: string;
    filename: string;
    relative_path: string;
    asset_family: string;
    source_type: string;
    crop_scopes: string[];
}

export interface RagAssistantResult {
    source_locator?: string | null;
    score: number;
    text: string;
    chunk_type?: string | null;
    topic_major?: string | null;
    topic_minor?: string | null;
    document: RagAssistantResultDocument;
}

interface RagAssistantResponse {
    detail?: string;
    message?: string;
    query_status?: string;
    query_mode?: string;
    limit?: number;
    returned_count?: number;
    results?: RagAssistantResult[];
    database?: {
        status?: string;
    };
}

export interface RagAssistantSearchArgs {
    crop: CropType;
    query: string;
    limit?: number;
    filters?: RagAssistantFilters;
}

function cropToApiKey(crop: CropType): string {
    return crop.toLowerCase();
}

export function useRagAssistant() {
    const controllerRef = useRef<AbortController | null>(null);
    const requestVersionRef = useRef(0);
    const [results, setResults] = useState<RagAssistantResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastQuery, setLastQuery] = useState<string | null>(null);
    const [lastQueryMode, setLastQueryMode] = useState<string | null>(null);
    const [queryStatus, setQueryStatus] = useState<string | null>(null);
    const [databaseStatus, setDatabaseStatus] = useState<string | null>(null);
    const [returnedCount, setReturnedCount] = useState(0);
    const [resolvedLimit, setResolvedLimit] = useState<number | null>(null);

    async function runSearch({
        crop,
        query,
        limit = 6,
        filters,
    }: RagAssistantSearchArgs): Promise<void> {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) {
            setError('query must not be empty');
            setResults([]);
            setLastQuery(null);
            setReturnedCount(0);
            return;
        }

        setLoading(true);
        setError(null);
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        const requestVersion = requestVersionRef.current + 1;
        requestVersionRef.current = requestVersion;
        try {
            const response = await fetch(`${API_URL}/knowledge/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    crop: cropToApiKey(crop),
                    query: normalizedQuery,
                    limit,
                    filters,
                }),
            });

            const payload = (await response.json()) as RagAssistantResponse;
            if (!response.ok) {
                throw new Error(
                    payload.detail ?? payload.message ?? `HTTP ${response.status}`,
                );
            }

            if (requestVersion !== requestVersionRef.current) {
                return;
            }

            setResults(payload.results ?? []);
            setLastQuery(normalizedQuery);
            setLastQueryMode(payload.query_mode ?? null);
            setQueryStatus(payload.query_status ?? null);
            setDatabaseStatus(
                payload.database?.status ??
                    (payload.query_status === 'database_missing' ? 'missing' : null),
            );
            setReturnedCount(payload.returned_count ?? (payload.results?.length ?? 0));
            setResolvedLimit(payload.limit ?? limit);
        } catch (err) {
            if (controller.signal.aborted || requestVersion !== requestVersionRef.current) {
                return;
            }
            setResults([]);
            setLastQuery(normalizedQuery);
            setLastQueryMode(null);
            setQueryStatus(null);
            setDatabaseStatus(null);
            setReturnedCount(0);
            setResolvedLimit(limit);
            setError(err instanceof Error ? err.message : 'unknown_error');
        } finally {
            if (requestVersion === requestVersionRef.current) {
                setLoading(false);
            }
        }
    }

    function clear() {
        controllerRef.current?.abort();
        controllerRef.current = null;
        requestVersionRef.current += 1;
        setResults([]);
        setLoading(false);
        setError(null);
        setLastQuery(null);
        setLastQueryMode(null);
        setQueryStatus(null);
        setDatabaseStatus(null);
        setReturnedCount(0);
        setResolvedLimit(null);
    }

    return {
        results,
        loading,
        error,
        lastQuery,
        lastQueryMode,
        queryStatus,
        databaseStatus,
        returnedCount,
        resolvedLimit,
        runSearch,
        clear,
    };
}
