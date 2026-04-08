import { useState, useCallback, useRef } from 'react';
import type {
    SensorData,
    AdvancedModelMetrics,
    ForecastData,
    CropType,
    ProducePricesPayload,
    RtrProfile,
    WeatherOutlook,
} from '../types';
import { API_URL } from '../config';
import { useLocale } from '../i18n/LocaleProvider';
import { buildAiDashboardContext } from '../utils/aiDashboardContext';
import type {
    AdvisorDisplayPayload,
    ModelRuntimePayload,
} from './useSmartGrowAdvisor';

type ConsultResponse = {
    detail?: string;
    message?: string;
    text?: string;
    machine_payload?: {
        display?: AdvisorDisplayPayload | null;
        actions?: Array<{
            title?: string;
            message?: string;
        }>;
        model_runtime?: ModelRuntimePayload | null;
    };
};

function extractRecommendationCandidates(response: ConsultResponse | null): string[] {
    const display = response?.machine_payload?.display;
    const structuredDisplayActions = [
        ...(display?.actions_now ?? []),
        ...(display?.actions_today ?? []),
        ...(display?.actions_week ?? []),
    ].map((action) => action.trim()).filter(Boolean);
    if (structuredDisplayActions.length > 0) {
        return structuredDisplayActions.slice(0, 5);
    }

    const actions = response?.machine_payload?.actions ?? [];
    const structuredActions = actions
        .map((action) => (action.title || action.message || '').trim())
        .filter(Boolean);
    if (structuredActions.length > 0) {
        return structuredActions.slice(0, 5);
    }

    const text = (response?.text || '').replace(/\r\n/g, '\n');
    if (!text) {
        return [];
    }

    const recommendationMatch = text.match(
        /^##\s+(?:Recommendations(?:\s*\(.*?\))?|권장 조치|지금 할 일|오늘 할 일)\s*\n([\s\S]*?)(?:\n##\s+|\s*$)/im,
    );
    const recommendationBlock = recommendationMatch?.[1] ?? text;

    return recommendationBlock
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^([-*]|\d+\.)\s+/.test(line))
        .map((line) => line.replace(/^([-*]|\d+\.)\s+/, '').trim())
        .filter(Boolean)
        .slice(0, 5);
}

export const useAiAssistant = () => {
    const { locale } = useLocale();
    const [aiAnalysis, setAiAnalysis] = useState<string>("");
    const [aiDisplay, setAiDisplay] = useState<AdvisorDisplayPayload | null>(null);
    const [aiModelRuntime, setAiModelRuntime] = useState<ModelRuntimePayload | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const requestIdRef = useRef(0);

    const analyzeData = useCallback(async (
        data: SensorData,
        metrics: AdvancedModelMetrics,
        crop: CropType,
        history: SensorData[] = [],
        forecast?: ForecastData | null,
        producePrices?: ProducePricesPayload | null,
        weather?: WeatherOutlook | null,
        rtrProfile?: RtrProfile | null,
        callback?: (recommendations: string[]) => void
    ) => {
        requestIdRef.current += 1;
        const requestId = requestIdRef.current;
        setIsAnalyzing(true);
        setAiDisplay(null);
        setAiModelRuntime(null);
        try {
            const cropKey = crop.toLowerCase();
            const dashboard = buildAiDashboardContext({
                currentData: data,
                metrics,
                crop,
                history,
                forecast,
                producePrices,
                weather,
                rtrProfile,
            });
            const res = await fetch(`${API_URL}/advisor/summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ crop: cropKey, dashboard, language: locale })
            });
            const raw = await res.text();
            let json: ConsultResponse | null = null;
            try {
                json = raw ? JSON.parse(raw) as ConsultResponse : null;
            } catch {
                json = null;
            }

            if (!res.ok) {
                const message = json?.detail ?? json?.message ?? raw ?? `HTTP ${res.status}`;
                throw new Error(message);
            }

            if (requestId !== requestIdRef.current) {
                return;
            }
            setAiAnalysis(json?.text || "");
            setAiDisplay(json?.machine_payload?.display ?? null);
            setAiModelRuntime(json?.machine_payload?.model_runtime ?? null);
            if (callback) {
                callback(extractRecommendationCandidates(json));
            }
        } catch {
            if (requestId !== requestIdRef.current) {
                return;
            }
            setAiDisplay(null);
            setAiModelRuntime(null);
            setAiAnalysis(
                locale === 'ko'
                    ? '모델 상담을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
                    : 'AI consulting is temporarily unavailable. Please try again shortly.',
            );
        } finally {
            if (requestId === requestIdRef.current) {
                setIsAnalyzing(false);
            }
        }
    }, [locale]);

    return {
        aiAnalysis,
        aiDisplay,
        aiModelRuntime,
        isAnalyzing,
        analyzeData
    };
};
