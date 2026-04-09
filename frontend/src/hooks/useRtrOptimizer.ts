import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config';
import type {
    CropType,
    RtrOptimizationMode,
    RtrOptimizeResponse,
    RtrScenarioResponse,
    RtrSensitivityResponse,
    RtrStateResponse,
    TelemetryStatus,
} from '../types';

interface UseRtrOptimizerOptions {
    crop: CropType;
    greenhouseId?: string;
    actualAreaM2: number | null;
    actualAreaPyeong: number | null;
    actualAreaSource?: 'default' | 'server' | 'local';
    optimizerEnabled?: boolean;
    defaultMode?: RtrOptimizationMode;
    telemetryStatus?: TelemetryStatus;
}

interface RtrCustomScenarioDraft {
    label: string;
    day_heating_min_temp_C?: number;
    night_heating_min_temp_C?: number;
    day_cooling_target_C?: number;
    night_cooling_target_C?: number;
    vent_bias_C?: number;
    screen_bias_pct?: number;
    circulation_fan_pct?: number;
    co2_target_ppm?: number;
}

const DEFAULT_MODE: RtrOptimizationMode = 'balanced';

async function readJson<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
        throw new Error((data as { detail?: string })?.detail ?? `HTTP ${response.status}`);
    }
    return data as T;
}

export const useRtrOptimizer = ({
    crop,
    greenhouseId,
    actualAreaM2,
    actualAreaPyeong,
    actualAreaSource = 'default',
    optimizerEnabled = true,
    defaultMode = DEFAULT_MODE,
    telemetryStatus = 'live',
}: UseRtrOptimizerOptions) => {
    const [stateResponse, setStateResponse] = useState<RtrStateResponse | null>(null);
    const [optimizeResponse, setOptimizeResponse] = useState<RtrOptimizeResponse | null>(null);
    const [scenarioResponse, setScenarioResponse] = useState<RtrScenarioResponse | null>(null);
    const [sensitivityResponse, setSensitivityResponse] = useState<RtrSensitivityResponse | null>(null);
    const [targetNodeDevelopmentPerDay, setTargetNodeDevelopmentPerDay] = useState<number | null>(null);
    const [optimizationModeState, setOptimizationModeState] = useState<RtrOptimizationMode>(defaultMode);
    const [customScenario, setCustomScenario] = useState<RtrCustomScenarioDraft | null>(null);
    const [includeEnergyCost, setIncludeEnergyCost] = useState(true);
    const [includeCoolingCost, setIncludeCoolingCost] = useState(true);
    const [includeLaborCost, setIncludeLaborCost] = useState(true);
    const [loadingState, setLoadingState] = useState(true);
    const [loadingOptimize, setLoadingOptimize] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const stateRequestIdRef = useRef(0);
    const optimizeRequestIdRef = useRef(0);
    const defaultModeRef = useRef(defaultMode);
    const hasManualTargetRef = useRef(false);
    const hasManualModeRef = useRef(false);
    const hasSeenAreaPersistenceRef = useRef(false);
    const lastAreaPersistenceSignatureRef = useRef<string | null>(null);

    useEffect(() => {
        defaultModeRef.current = defaultMode;
    }, [defaultMode]);

    useEffect(() => {
        hasSeenAreaPersistenceRef.current = false;
        lastAreaPersistenceSignatureRef.current = null;
    }, [crop, greenhouseId]);

    useEffect(() => {
        setStateResponse(null);
        setOptimizeResponse(null);
        setScenarioResponse(null);
        setSensitivityResponse(null);
        setTargetNodeDevelopmentPerDay(null);
        hasManualTargetRef.current = false;
        hasManualModeRef.current = false;
        setOptimizationModeState(defaultModeRef.current);
        setCustomScenario(null);
        setIncludeEnergyCost(true);
        setIncludeCoolingCost(true);
        setIncludeLaborCost(true);
        setLoadingState(true);
        setError(null);
    }, [crop]);

    useEffect(() => {
        if (hasManualModeRef.current) {
            return;
        }
        setOptimizationModeState(defaultMode);
    }, [defaultMode]);

    const telemetryOptimizationBlocked = telemetryStatus === 'stale' || telemetryStatus === 'offline';
    const cropKey = useMemo(() => crop.toLowerCase(), [crop]);
    const stateRefreshMs = stateResponse?.status === 'success' ? 60000 : 5000;

    const stateQuery = useMemo(() => {
        const params = new URLSearchParams({ crop: cropKey });
        if (greenhouseId) {
            params.set('greenhouse_id', greenhouseId);
        }
        return params.toString();
    }, [cropKey, greenhouseId]);

    const refreshState = useCallback(async () => {
        const requestId = stateRequestIdRef.current + 1;
        stateRequestIdRef.current = requestId;
        setLoadingState(true);
        try {
            const response = await fetch(`${API_URL}/rtr/state?${stateQuery}`);
            const data = await readJson<RtrStateResponse>(response);
            if (stateRequestIdRef.current !== requestId) {
                return;
            }
            setStateResponse(data);
            setError(null);
        } catch (err) {
            if (stateRequestIdRef.current !== requestId) {
                return;
            }
            setError(err instanceof Error ? err.message : 'Failed to load RTR state.');
        } finally {
            if (stateRequestIdRef.current === requestId) {
                setLoadingState(false);
            }
        }
    }, [stateQuery]);

    useEffect(() => {
        void refreshState();
        const interval = window.setInterval(() => {
            void refreshState();
        }, stateRefreshMs);
        return () => window.clearInterval(interval);
    }, [refreshState, stateRefreshMs]);

    useEffect(() => {
        if (hasManualTargetRef.current) {
            return;
        }
        const predictedRate = stateResponse?.canonical_state?.growth?.predicted_node_rate_day;
        if (typeof predictedRate === 'number' && Number.isFinite(predictedRate) && predictedRate > 0) {
            const roundedPredictedRate = Number(predictedRate.toFixed(3));
            setTargetNodeDevelopmentPerDay((current) => (current === roundedPredictedRate ? current : roundedPredictedRate));
            return;
        }
        if (loadingState) {
            return;
        }
        setTargetNodeDevelopmentPerDay((current) => (current === null ? current : null));
    }, [loadingState, stateResponse]);

    const requestPayload = useMemo(() => {
        if (!optimizerEnabled || telemetryOptimizationBlocked || targetNodeDevelopmentPerDay === null) {
            return null;
        }

        return {
            crop: cropKey,
            greenhouse_id: greenhouseId,
            target_node_development_per_day: targetNodeDevelopmentPerDay,
            optimization_mode: optimizationModeState,
            include_energy_cost: includeEnergyCost,
            include_cooling_cost: includeCoolingCost,
            include_labor_cost: includeLaborCost,
            user_actual_area_m2: actualAreaM2 ?? undefined,
            user_actual_area_pyeong: actualAreaPyeong ?? undefined,
            target_horizon: 'today',
        };
    }, [
        actualAreaM2,
        actualAreaPyeong,
        cropKey,
        greenhouseId,
        includeEnergyCost,
        includeCoolingCost,
        includeLaborCost,
        optimizationModeState,
        optimizerEnabled,
        telemetryOptimizationBlocked,
        targetNodeDevelopmentPerDay,
    ]);

    const scenarioRequestPayload = useMemo(() => {
        if (!requestPayload) {
            return null;
        }
        return {
            ...requestPayload,
            custom_scenario: customScenario ?? undefined,
        };
    }, [customScenario, requestPayload]);

    const runOptimizer = useCallback(async () => {
        if (!optimizerEnabled || !requestPayload || !scenarioRequestPayload) {
            return;
        }

        const requestId = optimizeRequestIdRef.current + 1;
        optimizeRequestIdRef.current = requestId;
        setLoadingOptimize(true);
        try {
            const [optimizeData, scenarioData, sensitivityData] = await Promise.all([
                fetch(`${API_URL}/rtr/optimize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestPayload),
                }).then((response) => readJson<RtrOptimizeResponse>(response)),
                fetch(`${API_URL}/rtr/scenario`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(scenarioRequestPayload),
                }).then((response) => readJson<RtrScenarioResponse>(response)),
                fetch(`${API_URL}/rtr/sensitivity`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...requestPayload, step_c: 0.3 }),
                }).then((response) => readJson<RtrSensitivityResponse>(response)),
            ]);

            if (optimizeRequestIdRef.current !== requestId) {
                return;
            }

            setOptimizeResponse(optimizeData);
            setScenarioResponse(scenarioData);
            setSensitivityResponse(sensitivityData);
            setError(null);
        } catch (err) {
            if (optimizeRequestIdRef.current !== requestId) {
                return;
            }
            setError(err instanceof Error ? err.message : 'Failed to optimize RTR.');
        } finally {
            if (optimizeRequestIdRef.current === requestId) {
                setLoadingOptimize(false);
            }
        }
    }, [optimizerEnabled, requestPayload, scenarioRequestPayload]);

    useEffect(() => {
        if (!optimizerEnabled || targetNodeDevelopmentPerDay === null) {
            setOptimizeResponse(null);
            setScenarioResponse(null);
            setSensitivityResponse(null);
            return;
        }
        if (telemetryOptimizationBlocked || !requestPayload) {
            return;
        }
        void runOptimizer();
    }, [optimizerEnabled, requestPayload, runOptimizer, targetNodeDevelopmentPerDay, telemetryOptimizationBlocked]);

    useEffect(() => {
        const areaPersistenceSignature = JSON.stringify({
            crop,
            greenhouseId: greenhouseId ?? null,
            actualAreaM2,
            actualAreaPyeong,
            actualAreaSource,
        });
        if (!hasSeenAreaPersistenceRef.current) {
            hasSeenAreaPersistenceRef.current = true;
            lastAreaPersistenceSignatureRef.current = areaPersistenceSignature;
            return;
        }
        if (lastAreaPersistenceSignatureRef.current === areaPersistenceSignature) {
            return;
        }
        lastAreaPersistenceSignatureRef.current = areaPersistenceSignature;
        if (
            actualAreaSource !== 'local'
            || (actualAreaM2 === null && actualAreaPyeong === null)
            || (loadingState && stateResponse === null)
        ) {
            return;
        }
        const timer = window.setTimeout(() => {
            void fetch(`${API_URL}/rtr/area-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crop,
                    greenhouse_id: greenhouseId,
                    user_actual_area_m2: actualAreaM2 ?? undefined,
                    user_actual_area_pyeong: actualAreaPyeong ?? undefined,
                }),
            }).catch(() => {
                // Keep local-only storage if persistence fails.
            });
        }, 400);

        return () => window.clearTimeout(timer);
    }, [actualAreaM2, actualAreaPyeong, actualAreaSource, crop, greenhouseId, loadingState, stateResponse]);

    const setTargetNodeRate = useCallback((value: number | null) => {
        hasManualTargetRef.current = value !== null;
        setTargetNodeDevelopmentPerDay(value);
    }, []);

    const setOptimizationMode = useCallback((mode: RtrOptimizationMode) => {
        hasManualModeRef.current = true;
        setOptimizationModeState(mode);
    }, []);

    return {
        stateResponse,
        optimizeResponse,
        scenarioResponse,
        sensitivityResponse,
        targetNodeDevelopmentPerDay,
        setTargetNodeDevelopmentPerDay: setTargetNodeRate,
        optimizationMode: optimizationModeState,
        setOptimizationMode,
        customScenario,
        setCustomScenario,
        includeEnergyCost,
        setIncludeEnergyCost,
        includeCoolingCost,
        setIncludeCoolingCost,
        includeLaborCost,
        setIncludeLaborCost,
        telemetryOptimizationBlocked,
        loading: loadingState || loadingOptimize,
        loadingState,
        loadingOptimize,
        error,
        refreshState,
        refreshOptimization: runOptimizer,
    };
};
