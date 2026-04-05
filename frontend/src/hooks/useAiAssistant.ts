import { useState, useCallback } from 'react';
import type {
    SensorData,
    AdvancedModelMetrics,
    ForecastData,
    CropType,
    RtrProfile,
    WeatherOutlook,
} from '../types';
import { API_URL } from '../config';
import { useLocale } from '../i18n/LocaleProvider';
import { buildAiDashboardContext } from '../utils/aiDashboardContext';

type ConsultResponse = {
    detail?: string;
    message?: string;
    text?: string;
};

export const useAiAssistant = () => {
    const { locale } = useLocale();
    const [aiAnalysis, setAiAnalysis] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const analyzeData = useCallback(async (
        data: SensorData,
        metrics: AdvancedModelMetrics,
        crop: CropType,
        history: SensorData[] = [],
        forecast?: ForecastData | null,
        weather?: WeatherOutlook | null,
        rtrProfile?: RtrProfile | null,
        callback?: (recommendations: string[]) => void
    ) => {
        setIsAnalyzing(true);
        try {
            const cropKey = crop.toLowerCase();
            const dashboard = buildAiDashboardContext({
                currentData: data,
                metrics,
                crop,
                history,
                forecast,
                weather,
                rtrProfile,
            });
            const res = await fetch(`${API_URL}/ai/consult`, {
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

            setAiAnalysis(json?.text || "");
            if (callback) callback([]);
        } catch (e) {
            const message =
                e instanceof Error ? e.message : locale === 'ko' ? '알 수 없는 오류가 발생했습니다.' : 'An unknown error occurred.';
            setAiAnalysis(
                locale === 'ko'
                    ? `AI 컨설팅을 사용할 수 없습니다: ${message}`
                    : `AI consulting is unavailable: ${message}`,
            );
        } finally {
            setIsAnalyzing(false);
        }
    }, [locale]);

    return {
        aiAnalysis,
        isAnalyzing,
        analyzeData
    };
};
