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
import { buildAiDashboardContext } from '../utils/aiDashboardContext';

type ConsultResponse = {
    detail?: string;
    message?: string;
    text?: string;
};

export const useAiAssistant = () => {
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
                body: JSON.stringify({ crop: cropKey, dashboard, language: 'en' })
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
                e instanceof Error ? e.message : "An unknown error occurred.";
            setAiAnalysis(`AI consulting is unavailable: ${message}`);
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    return {
        aiAnalysis,
        isAnalyzing,
        analyzeData
    };
};
