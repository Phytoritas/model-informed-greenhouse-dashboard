import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import type { CropType } from '../types';

const KNOWLEDGE_STATUS_REFRESH_MS = 60_000;
const KNOWLEDGE_STATUS_RECOVERY_REFRESH_MS = 5_000;

type AdvisorySurfacePayload = {
    status?: string;
    route?: string;
    limitations?: string[];
    request_contract?: {
        required?: string[];
        optional?: string[];
    };
    coverage?: {
        stages?: string[];
        mediums?: string[];
        source_water_analytes?: string[];
        drain_water_analytes?: string[];
        fertilizer_names?: string[];
        stock_tank_draft_mode?: string;
        macro_bundle_mode?: string;
    };
};

type KnowledgeStatusPayload = {
    summary?: {
        advisory_surface_names?: string[];
        pending_parsers?: string[];
    };
    advisory_surfaces?: {
        pesticide?: AdvisorySurfacePayload;
        nutrient?: AdvisorySurfacePayload;
        nutrient_correction?: AdvisorySurfacePayload;
    };
};

export interface SmartGrowKnowledgeSummary {
    cropKey: string;
    advisorySurfaceNames: string[];
    pendingParsers: string[];
    surfaces: SmartGrowAdvisorySurfaceSummary[];
    pesticideReady: boolean;
    nutrientReady: boolean;
    nutrientCorrectionReady: boolean;
    nutrientCorrectionDraftMode: string | null;
    nutrientCorrectionLimitation: string | null;
}

export interface SmartGrowAdvisorySurfaceSummary {
    key: 'pesticide' | 'nutrient' | 'nutrient_correction';
    status: string;
    route: string | null;
    requiredFields: string[];
    optionalFields: string[];
    stages: string[];
    mediums: string[];
    sourceWaterAnalytes: string[];
    drainWaterAnalytes: string[];
    fertilizerNames: string[];
    draftMode: string | null;
    macroBundleMode: string | null;
    limitation: string | null;
}

const SURFACE_KEYS = [
    'pesticide',
    'nutrient',
    'nutrient_correction',
] as const;

function deriveSurfaceSummary(
    key: typeof SURFACE_KEYS[number],
    payload: AdvisorySurfacePayload | undefined,
): SmartGrowAdvisorySurfaceSummary {
    return {
        key,
        status: payload?.status ?? 'unavailable',
        route: payload?.route ?? null,
        requiredFields: payload?.request_contract?.required ?? [],
        optionalFields: payload?.request_contract?.optional ?? [],
        stages: payload?.coverage?.stages ?? [],
        mediums: payload?.coverage?.mediums ?? [],
        sourceWaterAnalytes: payload?.coverage?.source_water_analytes ?? [],
        drainWaterAnalytes: payload?.coverage?.drain_water_analytes ?? [],
        fertilizerNames: payload?.coverage?.fertilizer_names ?? [],
        draftMode: payload?.coverage?.stock_tank_draft_mode ?? null,
        macroBundleMode: payload?.coverage?.macro_bundle_mode ?? null,
        limitation: payload?.limitations?.[0] ?? null,
    };
}

function cropToApiKey(crop: CropType): string {
    return crop.toLowerCase();
}

function deriveSummary(
    crop: CropType,
    payload: KnowledgeStatusPayload | null,
): SmartGrowKnowledgeSummary {
    const advisorySurfaces = payload?.advisory_surfaces ?? {};
    const nutrientCorrection = advisorySurfaces.nutrient_correction;

    return {
        cropKey: cropToApiKey(crop),
        advisorySurfaceNames: payload?.summary?.advisory_surface_names ?? [],
        pendingParsers: payload?.summary?.pending_parsers ?? [],
        surfaces: SURFACE_KEYS.map((key) =>
            deriveSurfaceSummary(key, advisorySurfaces[key]),
        ),
        pesticideReady: advisorySurfaces.pesticide?.status === 'ready',
        nutrientReady: advisorySurfaces.nutrient?.status === 'ready',
        nutrientCorrectionReady: nutrientCorrection?.status === 'ready',
        nutrientCorrectionDraftMode:
            nutrientCorrection?.coverage?.stock_tank_draft_mode ?? null,
        nutrientCorrectionLimitation: nutrientCorrection?.limitations?.[0] ?? null,
    };
}

export function useSmartGrowKnowledge(crop: CropType) {
    const [summary, setSummary] = useState<SmartGrowKnowledgeSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cropKey = cropToApiKey(crop);
    const hasSummary = summary !== null && error === null;
    const refreshMs = hasSummary ? KNOWLEDGE_STATUS_REFRESH_MS : KNOWLEDGE_STATUS_RECOVERY_REFRESH_MS;

    useEffect(() => {
        const controller = new AbortController();

        async function loadKnowledgeStatus() {
            setLoading(!hasSummary);
            try {
                const response = await fetch(
                    `${API_URL}/knowledge/status?crop=${encodeURIComponent(cropKey)}`,
                    {
                        method: 'GET',
                        signal: controller.signal,
                    },
                );

                const payload = (await response.json()) as KnowledgeStatusPayload & {
                    detail?: string;
                    message?: string;
                };

                if (!response.ok) {
                    throw new Error(
                        payload.detail ?? payload.message ?? `HTTP ${response.status}`,
                    );
                }

                setSummary(deriveSummary(crop, payload));
                setError(null);
            } catch (err) {
                if (controller.signal.aborted) {
                    return;
                }
                setError(err instanceof Error ? err.message : 'unknown_error');
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadKnowledgeStatus();
        const interval = window.setInterval(() => {
            void loadKnowledgeStatus();
        }, refreshMs);
        return () => {
            controller.abort();
            window.clearInterval(interval);
        };
    }, [crop, cropKey, hasSummary, refreshMs]);

    return {
        summary,
        loading,
        error,
    };
}
