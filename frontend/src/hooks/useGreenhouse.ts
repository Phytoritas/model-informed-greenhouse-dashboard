import { startTransition, useState, useEffect, useCallback, useRef } from 'react';
import type {
    SensorData,
    ControlStatus,
    AdvancedModelMetrics,
    CropType,
    TemperatureSettings,
    ForecastData,
    MetricHistoryPoint,
} from '../types';
import { API_URL, WS_URL } from '../config';

const DEFAULT_TEMP_SETTINGS_BY_CROP: Record<CropType, TemperatureSettings> = {
    Tomato: { heating: 18, cooling: 26 },
    Cucumber: { heating: 18, cooling: 26 },
};

type BackendEnv = {
    T_air_C?: number;
    RH_percent?: number;
    CO2_ppm?: number;
    PAR_umol?: number;
    VPD_kPa?: number;
    soil_moisture_pct?: number;
};

type BackendFlux = {
    gross_photosynthesis_umol_m2_s?: number;
    H_W_m2?: number;
    LE_W_m2?: number;
};

type BackendState = {
    datetime?: string;
    T_air_C?: number;
    T_canopy_C?: number;
    gross_photosynthesis_umol_m2_s?: number;
    H_W_m2?: number;
    LE_W_m2?: number;
    leaf_dry_weight_g_m2?: number;
    stem_dry_weight_g_m2?: number;
    root_dry_weight_g_m2?: number;
    fruit_dry_weight_g_m2?: number;
    LAI?: number;
    development_stage?: string;
    active_trusses?: number;
    node_count?: number;
    n_fruits?: number;
    truss_count?: number;
};

type BackendKpi = {
    transpiration_mm_h?: number;
    stomatal_conductance?: number;
    daily_fruit_growth_g_m2?: number;
    daily_harvest_kg?: number;
    yield_confidence?: number;
};

type BackendEnergy = {
    P_elec_kW?: number;
    COP_current?: number;
    Q_load_kW?: number;
    mode?: string;
};

type BackendPayload = {
    t?: string;
    env?: BackendEnv;
    flux?: BackendFlux;
    state?: BackendState;
    kpi?: BackendKpi;
    energy?: BackendEnergy;
};

type NullableByCrop<T> = Record<CropType, T | null>;
type ArrayByCrop<T> = Record<CropType, T[]>;

const AREA_M2 = 3305.8;
const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY_POINTS = 288;
const STREAM_COMMIT_INTERVAL_MS = 250;

const appendUniquePoint = <T extends { timestamp: number }>(series: T[], point: T): T[] => {
    const nextSeries = [...series];
    const lastPoint = nextSeries[nextSeries.length - 1];

    if (lastPoint?.timestamp === point.timestamp) {
        nextSeries[nextSeries.length - 1] = point;
        return nextSeries;
    }

    nextSeries.push(point);

    const windowStart = point.timestamp - HISTORY_WINDOW_MS;
    while (nextSeries.length > 0 && nextSeries[0].timestamp < windowStart) {
        nextSeries.shift();
    }

    if (nextSeries.length > MAX_HISTORY_POINTS) {
        nextSeries.splice(0, nextSeries.length - MAX_HISTORY_POINTS);
    }

    return nextSeries;
};

export const useGreenhouse = () => {
    const [selectedCrop, setSelectedCrop] = useState<CropType>('Cucumber');
    const settingsByCropRef = useRef<Record<CropType, TemperatureSettings>>({
        Tomato: { ...DEFAULT_TEMP_SETTINGS_BY_CROP.Tomato },
        Cucumber: { ...DEFAULT_TEMP_SETTINGS_BY_CROP.Cucumber },
    });
    const [currentDataByCrop, setCurrentDataByCrop] = useState<NullableByCrop<SensorData>>({
        Tomato: null,
        Cucumber: null,
    });
    const [modelMetricsByCrop, setModelMetricsByCrop] = useState<NullableByCrop<AdvancedModelMetrics>>({
        Tomato: null,
        Cucumber: null,
    });
    const [historyByCrop, setHistoryByCrop] = useState<ArrayByCrop<SensorData>>({
        Tomato: [],
        Cucumber: [],
    });
    const [metricHistoryByCrop, setMetricHistoryByCrop] = useState<ArrayByCrop<MetricHistoryPoint>>({
        Tomato: [],
        Cucumber: [],
    });
    const [controls, setControls] = useState<ControlStatus>({
        ventilation: false,
        irrigation: false,
        heating: false,
        shading: false,
        settings: settingsByCropRef.current.Cucumber,
    });
    const wsRef = useRef<WebSocket | null>(null);
    const [startTimestampByCrop, setStartTimestampByCrop] = useState<Record<CropType, number | null>>({
        Tomato: null,
        Cucumber: null,
    });
    const [forecastByCrop, setForecastByCrop] = useState<NullableByCrop<ForecastData>>({
        Tomato: null,
        Cucumber: null,
    });
    const liveStateRef = useRef<{
        currentDataByCrop: NullableByCrop<SensorData>;
        modelMetricsByCrop: NullableByCrop<AdvancedModelMetrics>;
        historyByCrop: ArrayByCrop<SensorData>;
        metricHistoryByCrop: ArrayByCrop<MetricHistoryPoint>;
        startTimestampByCrop: Record<CropType, number | null>;
    }>({
        currentDataByCrop: {
            Tomato: null,
            Cucumber: null,
        },
        modelMetricsByCrop: {
            Tomato: null,
            Cucumber: null,
        },
        historyByCrop: {
            Tomato: [],
            Cucumber: [],
        },
        metricHistoryByCrop: {
            Tomato: [],
            Cucumber: [],
        },
        startTimestampByCrop: {
            Tomato: null,
            Cucumber: null,
        },
    });
    const pendingFlushTimerRef = useRef<Record<CropType, number | null>>({
        Tomato: null,
        Cucumber: null,
    });
    const lastFlushAtRef = useRef<Record<CropType, number>>({
        Tomato: 0,
        Cucumber: 0,
    });
    const forecastRequestIdRef = useRef<Record<CropType, number>>({
        Tomato: 0,
        Cucumber: 0,
    });
    const costPerKwhRef = useRef<Record<CropType, number>>({
        Tomato: 0.15,
        Cucumber: 0.15,
    });

    // Helper to map backend payload to frontend types
    const mapPayloadToData = useCallback((
        payload: BackendPayload,
        cropType: CropType
    ): { sensor: SensorData; metrics: AdvancedModelMetrics; metricPoint: MetricHistoryPoint } => {
        const now = Date.now();

        // Map Environment Data
        // Backend sends: T_air_C, RH_percent, CO2_ppm, PAR_umol, VPD_kPa
        const tsCandidate = payload.t
            ? new Date(payload.t).getTime()
            : (payload.state?.datetime ? new Date(payload.state.datetime).getTime() : now);
        const ts = Number.isFinite(tsCandidate) ? tsCandidate : now;

        const sensor: SensorData = {
            timestamp: ts,
            temperature: payload.env?.T_air_C ?? payload.state?.T_air_C ?? 0,
            canopyTemp: payload.state?.T_canopy_C ?? payload.env?.T_air_C ?? 0,
            humidity: payload.env?.RH_percent ?? 0, // Fixed: RH_pct -> RH_percent
            co2: payload.env?.CO2_ppm ?? 400,
            light: payload.env?.PAR_umol ?? 0, // Fixed: PAR_uE -> PAR_umol
            soilMoisture: payload.env?.soil_moisture_pct ?? 60,
            vpd: payload.env?.VPD_kPa ?? 0,
            transpiration: payload.kpi?.transpiration_mm_h ?? 0,
            stomatalConductance: payload.kpi?.stomatal_conductance ?? 0, // mol m-2 s-1
            photosynthesis: payload.flux?.gross_photosynthesis_umol_m2_s
                ?? payload.state?.gross_photosynthesis_umol_m2_s
                ?? 0,
            hFlux: payload.flux?.H_W_m2 ?? payload.state?.H_W_m2 ?? 0,
            leFlux: payload.flux?.LE_W_m2 ?? payload.state?.LE_W_m2 ?? 0,
            energyUsage: payload.energy?.P_elec_kW ?? 0 // Use Total Power (kW)
        };

        // Calculate Biomass from State (g/m2)
        const state = payload.state || {};
        const totalBiomass = (
            (state.leaf_dry_weight_g_m2 || 0) +
            (state.stem_dry_weight_g_m2 || 0) +
            (state.root_dry_weight_g_m2 || 0) +
            (state.fruit_dry_weight_g_m2 || 0)
        );

        // Calculate Growth Rate (g/m²/d)
        let growthRate = 0;
        if (payload.kpi?.daily_fruit_growth_g_m2) {
            growthRate = payload.kpi.daily_fruit_growth_g_m2;
        } else if (payload.kpi?.daily_harvest_kg) {
            // Convert Total kg to g/m²: (kg * 1000) / area
            // Assuming default area 3305.8 m² if not available
            growthRate = (payload.kpi.daily_harvest_kg * 1000) / AREA_M2;
        }

        // Map Metrics
        const metrics: AdvancedModelMetrics = {
            cropType,
            growth: {
                lai: state.LAI || 0,
                biomass: totalBiomass,
                developmentStage: state.development_stage || "Growing",
                growthRate: growthRate,
                activeTrusses: state.active_trusses,
                nodeCount: state.node_count
            },
            yield: {
                predictedWeekly: (payload.kpi?.daily_harvest_kg || 0) * 7, // Simple projection
                confidence: payload.kpi?.yield_confidence || 85,
                harvestableFruits: state.n_fruits || state.truss_count || 0
            },
            energy: {
                consumption: payload.energy?.P_elec_kW || 0,
                // cost per hour = kW * (currency/kWh)
                costPrediction: (payload.energy?.P_elec_kW || 0) * costPerKwhRef.current[cropType],
                efficiency: payload.energy?.COP_current || 0,
                loadKw: payload.energy?.Q_load_kW,
                mode: payload.energy?.mode
            }
        };

        const metricPoint: MetricHistoryPoint = {
            timestamp: ts,
            lai: metrics.growth.lai,
            biomass: metrics.growth.biomass,
            growthRate: metrics.growth.growthRate,
            predictedWeeklyYield: metrics.yield.predictedWeekly,
            harvestableFruits: metrics.yield.harvestableFruits,
            energyConsumption: metrics.energy.consumption,
            energyLoadKw: metrics.energy.loadKw ?? metrics.energy.consumption,
            energyEfficiency: metrics.energy.efficiency,
        };

        return { sensor, metrics, metricPoint };
    }, []);

    const flushCropState = useCallback((cropType: CropType) => {
        const liveState = liveStateRef.current;
        pendingFlushTimerRef.current[cropType] = null;
        lastFlushAtRef.current[cropType] = Date.now();

        startTransition(() => {
            setCurrentDataByCrop(prev => {
                const next = liveState.currentDataByCrop[cropType];
                return prev[cropType] === next
                    ? prev
                    : {
                        ...prev,
                        [cropType]: next,
                    };
            });
            setModelMetricsByCrop(prev => {
                const next = liveState.modelMetricsByCrop[cropType];
                return prev[cropType] === next
                    ? prev
                    : {
                        ...prev,
                        [cropType]: next,
                    };
            });
            setHistoryByCrop(prev => {
                const next = liveState.historyByCrop[cropType];
                return prev[cropType] === next
                    ? prev
                    : {
                        ...prev,
                        [cropType]: next,
                    };
            });
            setMetricHistoryByCrop(prev => {
                const next = liveState.metricHistoryByCrop[cropType];
                return prev[cropType] === next
                    ? prev
                    : {
                        ...prev,
                        [cropType]: next,
                    };
            });
            setStartTimestampByCrop(prev => {
                const next = liveState.startTimestampByCrop[cropType];
                return prev[cropType] === next
                    ? prev
                    : {
                        ...prev,
                        [cropType]: next,
                    };
            });
        });
    }, []);

    // Connect to WebSocket
    useEffect(() => {
        const cropAtConnection = selectedCrop;
        const cropPath = cropAtConnection.toLowerCase();
        const flushTimers = pendingFlushTimerRef.current;
        const lastFlushTimes = lastFlushAtRef.current;
        const ws = new WebSocket(`${WS_URL}/${cropPath}`);
        let closedByCleanup = false;

        ws.onopen = () => {
            console.log(`Connected to ${cropAtConnection} simulation WebSocket`);
        };

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                const { sensor, metrics, metricPoint } = mapPayloadToData(payload, cropAtConnection);
                const liveState = liveStateRef.current;
                liveState.currentDataByCrop[cropAtConnection] = sensor;
                liveState.modelMetricsByCrop[cropAtConnection] = metrics;
                liveState.historyByCrop[cropAtConnection] = appendUniquePoint(
                    liveState.historyByCrop[cropAtConnection],
                    sensor,
                );
                liveState.metricHistoryByCrop[cropAtConnection] = appendUniquePoint(
                    liveState.metricHistoryByCrop[cropAtConnection],
                    metricPoint,
                );
                liveState.startTimestampByCrop[cropAtConnection] =
                    liveState.startTimestampByCrop[cropAtConnection] ?? sensor.timestamp;

                const now = Date.now();
                const elapsed = now - lastFlushTimes[cropAtConnection];
                const pendingTimer = flushTimers[cropAtConnection];

                if (elapsed >= STREAM_COMMIT_INTERVAL_MS) {
                    if (pendingTimer !== null) {
                        window.clearTimeout(pendingTimer);
                    }
                    flushCropState(cropAtConnection);
                    return;
                }

                if (pendingTimer === null) {
                    flushTimers[cropAtConnection] = window.setTimeout(
                        () => flushCropState(cropAtConnection),
                        STREAM_COMMIT_INTERVAL_MS - elapsed,
                    );
                }

                // Update controls state if backend sends it (e.g., active heating/ventilation)
                // The backend payload structure doesn't explicitly show active controls,
                // so we'll assume it might be under payload.controls or infer from other data.
                // For now, we'll keep the local controls state as is, or update if backend provides.
                // If backend sends active controls, uncomment and adjust:
                // if (payload.active_controls) {
                //   setControls(c => ({ ...c, ...payload.active_controls }));
                // }

            } catch (err) {
                console.error("Error parsing WS message:", err);
            }
        };

        ws.onclose = () => {
            if (closedByCleanup) {
                return;
            }
            console.log(`Disconnected from ${cropAtConnection} simulation WebSocket`);
            // Attempt to reconnect or handle gracefully
        };

        ws.onerror = (error) => {
            if (closedByCleanup || ws.readyState >= WebSocket.CLOSING) {
                return;
            }
            console.error(`WebSocket error for ${cropAtConnection}:`, error);
        };

        wsRef.current = ws;

        return () => {
            const pendingTimer = flushTimers[cropAtConnection];
            if (pendingTimer !== null) {
                window.clearTimeout(pendingTimer);
                flushCropState(cropAtConnection);
            }
            if (wsRef.current) {
                closedByCleanup = true;
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [flushCropState, mapPayloadToData, selectedCrop]);

    // Restore crop-specific controls when the user switches crop tabs
    useEffect(() => {
        setControls({
            ventilation: false,
            irrigation: false,
            heating: false,
            shading: false,
            settings: settingsByCropRef.current[selectedCrop],
        });
    }, [selectedCrop]);

    // Fetch pricing/settings (cost per kWh) for the selected crop
    useEffect(() => {
        const cropKey = selectedCrop.toLowerCase();
        const fetchSettings = async () => {
            try {
                const res = await fetch(`${API_URL}/settings?crop=${cropKey}`);
                if (!res.ok) return;
                const data = await res.json();
                if (typeof data?.cost_per_kwh === 'number') {
                    costPerKwhRef.current[selectedCrop] = data.cost_per_kwh;
                }
            } catch {
                // Keep fallback
            }
        };
        fetchSettings();
    }, [selectedCrop]);

    // Start Simulation on Mount (if not running)
    useEffect(() => {
        const startSimulation = async () => {
            try {
                const cropKey = selectedCrop.toLowerCase();

                // Check status first
                const statusRes = await fetch(`${API_URL}/status`);
                if (!statusRes.ok) throw new Error(`HTTP error! status: ${statusRes.status}`);
                const statusData = await statusRes.json();
                const cropStatus = statusData?.greenhouses?.[cropKey];
                const totalRows = typeof cropStatus?.total_rows === 'number' ? cropStatus.total_rows : 0;
                const idx = typeof cropStatus?.idx === 'number' ? cropStatus.idx : -1;
                const isExhausted =
                    cropStatus?.at_end === true ||
                    cropStatus?.status === 'completed' ||
                    (totalRows > 0 && idx >= totalRows - 1) ||
                    (typeof cropStatus?.progress === 'number' && cropStatus.progress >= 99.9);

                if (cropStatus?.status !== 'active' || isExhausted) {
                    console.log(`Simulation for ${selectedCrop} is idle or exhausted, starting...`);
                    // Start simulation
                    const startRes = await fetch(`${API_URL}/start`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            crop: cropKey,
                            csv_filename: selectedCrop === 'Tomato' ? 'Tomato_Env.CSV' : 'Cucumber_Env.CSV',
                            time_step: '10min' // Faster simulation
                        })
                    });
                    if (!startRes.ok) throw new Error(`HTTP error! status: ${startRes.status}`);
                    console.log(`Simulation for ${selectedCrop} started.`);
                } else {
                    console.log(`Simulation for ${selectedCrop} already active.`);
                }
            } catch (err) {
                console.error("Failed to start simulation:", err);
            }
        };

        startSimulation();
    }, [selectedCrop]);

    const toggleControl = useCallback((key: keyof ControlStatus) => {
        setControls(prev => ({ ...prev, [key]: !prev[key] }));
        // Note: These controls are local overrides for visualization. 
        // The backend simulation runs in automatic mode based on setpoints.
    }, []);

    const setControlValue = useCallback((key: keyof ControlStatus, value: boolean) => {
        setControls(prev => ({ ...prev, [key]: value }));
    }, []);

    const setTempSettings = useCallback(async (newSettings: TemperatureSettings) => {
        const cropKey = selectedCrop.toLowerCase();
        settingsByCropRef.current[selectedCrop] = newSettings;
        setControls(prev => ({ ...prev, settings: newSettings }));

        try {
            const res = await fetch(`${API_URL}/config/ops?crop=${cropKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    heating_set_C: newSettings.heating,
                    cooling_set_C: newSettings.cooling,
                    p_band_C: 4.0, // Default
                    co2_target_ppm: 800, // Default
                    drain_target_fraction: 0.3 // Default
                })
            });
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
        } catch (err) {
            console.error("Failed to update ops config:", err);
        }
    }, [selectedCrop]);

    // Initial default data to prevent crash before WS connects
    const defaultData: SensorData = {
        timestamp: Date.now(),
        temperature: 0,
        canopyTemp: 0,
        humidity: 0,
        co2: 0,
        light: 0,
        soilMoisture: 0,
        vpd: 0,
        transpiration: 0,
        stomatalConductance: 0,
        photosynthesis: 0,
        hFlux: 0,
        leFlux: 0,
        energyUsage: 0
    };

    // Fetch forecast for the active crop with stale-request protection
    const fetchForecast = useCallback(async (cropOverride?: CropType) => {
        const cropType = cropOverride ?? selectedCrop;
        const requestId = forecastRequestIdRef.current[cropType] + 1;
        forecastRequestIdRef.current[cropType] = requestId;

        try {
            const cropKey = cropType.toLowerCase();
            const res = await fetch(`${API_URL}/forecast/${cropKey}`);
            if (res.ok) {
                const data = await res.json();
                if (forecastRequestIdRef.current[cropType] !== requestId) {
                    return;
                }
                setForecastByCrop(prev => ({
                    ...prev,
                    [cropType]: data,
                }));
            }
        } catch (err) {
            console.error("Failed to fetch forecast:", err);
        }
    }, [selectedCrop]);

    // Initial fetch and periodic update for forecast
    useEffect(() => {
        void fetchForecast(selectedCrop);
        const interval = window.setInterval(() => {
            void fetchForecast(selectedCrop);
        }, 60000);
        return () => clearInterval(interval);
    }, [fetchForecast, selectedCrop]);

    const currentData = currentDataByCrop[selectedCrop];
    const history = historyByCrop[selectedCrop];
    const metricHistory = metricHistoryByCrop[selectedCrop];
    const forecast = forecastByCrop[selectedCrop];
    const startTimestamp = startTimestampByCrop[selectedCrop];

    // Derived timeline labels
    const currentTimestamp = currentData?.timestamp ?? Date.now();
    const growthDay = startTimestamp
        ? Math.max(1, Math.floor((currentTimestamp - startTimestamp) / (1000 * 60 * 60 * 24)) + 1)
        : null;
    const startDateLabel = startTimestamp ? new Date(startTimestamp).toLocaleDateString() : null;
    const currentDateLabel = new Date(currentTimestamp).toLocaleString();

    const defaultMetrics: AdvancedModelMetrics = {
        cropType: selectedCrop,
        growth: { lai: 0, biomass: 0, developmentStage: "Init", growthRate: 0 },
        yield: { predictedWeekly: 0, confidence: 0, harvestableFruits: 0 },
        energy: { consumption: 0, costPrediction: 0, efficiency: 0 }
    };

    const selectedMetrics = modelMetricsByCrop[selectedCrop] ?? defaultMetrics;

    return {
        selectedCrop,
        setSelectedCrop,
        currentData: currentData || defaultData,
        modelMetrics: {
            ...selectedMetrics,
            yield: {
                ...selectedMetrics.yield,
                predictedWeekly: forecast?.total_harvest_kg ?? selectedMetrics.yield.predictedWeekly
            }
        },
        history,
        metricHistory,
        forecast,
        controls,
        toggleControl,
        setControlValue,
        setTempSettings,
        growthDay,
        startDateLabel,
        currentDateLabel
    };
};
