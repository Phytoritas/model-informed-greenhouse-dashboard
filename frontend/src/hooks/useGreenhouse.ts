import { startTransition, useState, useEffect, useCallback, useRef } from 'react';
import type {
    SensorData,
    ControlStatus,
    AdvancedModelMetrics,
    CropType,
    SensorFieldAvailability,
    SensorFieldTimestamps,
    TelemetryStatus,
    TemperatureSettings,
    ForecastData,
    MetricHistoryPoint,
} from '../types';
import { API_URL, FORECAST_WS_URL, WS_URL } from '../config';
import {
    buildSimulationPaceRequest,
    DEFAULT_SIMULATION_PACE,
    readStoredSimulationPace,
} from './useSimulationRuntimeControls';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDate, formatLocaleDateTime } from '../i18n/locale';

const DEFAULT_TEMP_SETTINGS_BY_CROP: Record<CropType, TemperatureSettings> = {
    Tomato: { heating: 18, cooling: 26, pBand: 4, co2Target: 800, drainTarget: 0.3 },
    Cucumber: { heating: 18, cooling: 26, pBand: 4, co2Target: 800, drainTarget: 0.3 },
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
    simulation_status?: string;
    data_quality?: SensorData['dataQuality'];
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
    source_capacity?: number;
    sink_demand?: number;
    source_sink_balance?: number;
};

type BackendKpi = {
    transpiration_mm_h?: number;
    stomatal_conductance?: number;
    daily_fruit_growth_g_m2?: number;
    daily_harvest_kg?: number;
    yield_confidence?: number;
    harvest_basis?: string;
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
    data_quality?: SensorData['dataQuality'];
};

type ForecastSocketPayload = ForecastData | {
    type?: string;
    daily?: unknown;
    last?: Record<string, unknown>;
    total_harvest_kg?: unknown;
    total_ETc_mm?: unknown;
    total_energy_kWh?: unknown;
    total_fruit_growth_dry_kg?: number | null;
    total_harvested_dry_kg?: number | null;
    total_harvested_fruit_dry_kg?: number | null;
    data_quality?: SensorData['dataQuality'];
    harvest_basis?: string;
    fruit_growth_basis?: string;
    energy_basis?: string;
    message?: string;
};

type NullableByCrop<T> = Record<CropType, T | null>;
type ArrayByCrop<T> = Record<CropType, T[]>;
type TelemetryState = {
    status: TelemetryStatus;
    lastMessageAt: number | null;
};
type TelemetryByCrop = Record<CropType, TelemetryState>;
type AvailabilityByCrop = Record<CropType, SensorFieldAvailability>;
type TimestampByCrop = Record<CropType, SensorFieldTimestamps>;

const HISTORY_WINDOW_MS = 72 * 60 * 60 * 1000;
const MAX_HISTORY_POINTS = 864;
const STREAM_COMMIT_INTERVAL_MS = 250;
const STREAM_DELAY_THRESHOLD_MS = 8_000;
const STREAM_STALE_THRESHOLD_MS = 30_000;
const TELEMETRY_HEALTH_POLL_MS = 2_000;
const SIMULATION_RECOVERY_BACKOFF_MS = 15_000;
const STATUS_REQUEST_TIMEOUT_MS = 4_000;
const START_REQUEST_TIMEOUT_MS = 8_000;
const PACE_REQUEST_TIMEOUT_MS = 4_000;

const DEFAULT_SENSOR_FIELD_AVAILABILITY: SensorFieldAvailability = {
    temperature: false,
    humidity: false,
    co2: false,
    light: false,
    vpd: false,
    stomatalConductance: false,
    soilMoisture: false,
    canopyTemp: false,
    transpiration: false,
    photosynthesis: false,
    energyUsage: false,
    hFlux: false,
    leFlux: false,
};

const DEFAULT_SENSOR_FIELD_TIMESTAMPS: SensorFieldTimestamps = {
    temperature: null,
    humidity: null,
    co2: null,
    light: null,
    vpd: null,
    stomatalConductance: null,
};

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

function pickNumericValue(
    candidates: Array<number | undefined>,
    fallback: number,
): { value: number; available: boolean } {
    const resolved = candidates.find((candidate) => Number.isFinite(candidate));
    return {
        value: typeof resolved === 'number' ? resolved : fallback,
        available: typeof resolved === 'number',
    };
}

async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    timeoutMs: number,
): Promise<Response> {
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        window.clearTimeout(timeoutHandle);
    }
}

function isReconnectableSocket(socket: WebSocket | null): boolean {
    if (!socket) {
        return true;
    }

    return (
        socket.readyState === WebSocket.CLOSING
        || socket.readyState === WebSocket.CLOSED
    );
}

function normalizeForecastPayload(payload: ForecastSocketPayload): ForecastData | null {
    if (payload.type === 'forecast.error') {
        if (typeof payload.message === 'string') {
            console.warn(`Forecast WebSocket error: ${payload.message}`);
        }
        return null;
    }

    if (payload.type !== undefined && payload.type !== 'forecast.snapshot') {
        return null;
    }

    if (!Array.isArray(payload.daily)) {
        return null;
    }

    return {
        type: 'forecast.snapshot',
        daily: payload.daily as ForecastData['daily'],
        last: payload.last,
        total_harvest_kg: typeof payload.total_harvest_kg === 'number' ? payload.total_harvest_kg : null,
        total_ETc_mm: typeof payload.total_ETc_mm === 'number' ? payload.total_ETc_mm : null,
        total_energy_kWh: typeof payload.total_energy_kWh === 'number' ? payload.total_energy_kWh : null,
        total_fruit_growth_dry_kg: payload.total_fruit_growth_dry_kg,
        total_harvested_dry_kg: payload.total_harvested_dry_kg,
        total_harvested_fruit_dry_kg: payload.total_harvested_fruit_dry_kg,
        data_quality: payload.data_quality,
        harvest_basis: payload.harvest_basis,
        fruit_growth_basis: payload.fruit_growth_basis,
        energy_basis: payload.energy_basis,
        refreshed_at: new Date().toISOString(),
        refresh_error: null,
    };
}

export const useGreenhouse = () => {
    const { locale } = useLocale();
    const [selectedCrop, setSelectedCrop] = useState<CropType>('Cucumber');
    const selectedCropRef = useRef(selectedCrop);
    selectedCropRef.current = selectedCrop;
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
        settingsState: 'loading',
        settingsError: null,
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
    const [telemetryStateByCrop, setTelemetryStateByCrop] = useState<TelemetryByCrop>({
        Tomato: { status: 'loading', lastMessageAt: null },
        Cucumber: { status: 'loading', lastMessageAt: null },
    });
    const telemetryStateRef = useRef<TelemetryByCrop>({
        Tomato: { status: 'loading', lastMessageAt: null },
        Cucumber: { status: 'loading', lastMessageAt: null },
    });
    const [sensorFieldAvailabilityByCrop, setSensorFieldAvailabilityByCrop] = useState<AvailabilityByCrop>({
        Tomato: { ...DEFAULT_SENSOR_FIELD_AVAILABILITY },
        Cucumber: { ...DEFAULT_SENSOR_FIELD_AVAILABILITY },
    });
    const [sensorFieldTimestampsByCrop, setSensorFieldTimestampsByCrop] = useState<TimestampByCrop>({
        Tomato: { ...DEFAULT_SENSOR_FIELD_TIMESTAMPS },
        Cucumber: { ...DEFAULT_SENSOR_FIELD_TIMESTAMPS },
    });
    const [wsConnectionNonce, setWsConnectionNonce] = useState(0);
    const liveStateRef = useRef<{
        currentDataByCrop: NullableByCrop<SensorData>;
        modelMetricsByCrop: NullableByCrop<AdvancedModelMetrics>;
        historyByCrop: ArrayByCrop<SensorData>;
        metricHistoryByCrop: ArrayByCrop<MetricHistoryPoint>;
        startTimestampByCrop: Record<CropType, number | null>;
        sensorFieldAvailabilityByCrop: AvailabilityByCrop;
        sensorFieldTimestampsByCrop: TimestampByCrop;
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
        sensorFieldAvailabilityByCrop: {
            Tomato: { ...DEFAULT_SENSOR_FIELD_AVAILABILITY },
            Cucumber: { ...DEFAULT_SENSOR_FIELD_AVAILABILITY },
        },
        sensorFieldTimestampsByCrop: {
            Tomato: { ...DEFAULT_SENSOR_FIELD_TIMESTAMPS },
            Cucumber: { ...DEFAULT_SENSOR_FIELD_TIMESTAMPS },
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
        Tomato: 120,
        Cucumber: 120,
    });
    const recoveryAttemptAtRef = useRef<Record<CropType, number>>({
        Tomato: 0,
        Cucumber: 0,
    });
    const recoveryRequestInFlightRef = useRef<Record<CropType, boolean>>({
        Tomato: false,
        Cucumber: false,
    });

    useEffect(() => {
        telemetryStateRef.current = telemetryStateByCrop;
    }, [telemetryStateByCrop]);

    const requestWebSocketReconnect = useCallback((cropType: CropType) => {
        if (cropType !== selectedCrop) {
            return;
        }

        if (!isReconnectableSocket(wsRef.current)) {
            return;
        }

        setTelemetryStateByCrop((prev) => ({
            ...prev,
            [cropType]: {
                ...prev[cropType],
                status: 'loading',
            },
        }));
        setWsConnectionNonce((prev) => prev + 1);
    }, [selectedCrop]);

    // Reapply the effective simulation pace after a (re)connection so a fresh start or
    // a WebSocket reconnect keeps the selected pace instead of snapping back to the
    // backend default (R11). A stored pace wins; otherwise the readable default of 600
    // sim-seconds/real-second is applied so a fresh load does not run at the legacy
    // pace (R28), which the backend would otherwise derive as step_sim_duration / 0.1.
    const applyStoredSimulationPace = useCallback(async (cropType: CropType) => {
        const paceToApply = readStoredSimulationPace() ?? DEFAULT_SIMULATION_PACE;

        const { path, init } = buildSimulationPaceRequest(cropType, paceToApply);
        try {
            await fetchWithTimeout(`${API_URL}${path}`, init, PACE_REQUEST_TIMEOUT_MS);
        } catch (err) {
            const errorName = err instanceof Error ? err.name : '';
            if (errorName === 'AbortError') {
                console.warn(`Simulation pace restore for ${cropType} was aborted:`, err);
                return;
            }
            console.warn(`Failed to restore stored simulation pace for ${cropType}:`, err);
        }
    }, []);

    const ensureSimulationRunning = useCallback(async (cropType: CropType) => {
        if (recoveryRequestInFlightRef.current[cropType]) {
            return;
        }

        recoveryRequestInFlightRef.current[cropType] = true;
        recoveryAttemptAtRef.current[cropType] = Date.now();
        try {
            const cropKey = cropType.toLowerCase();
            const transportDisconnected =
                cropType === selectedCrop &&
                isReconnectableSocket(wsRef.current);

            if (transportDisconnected) {
                console.log(`Telemetry transport for ${cropType} is disconnected, reconnecting WebSocket.`);
                requestWebSocketReconnect(cropType);
            }

            const statusRes = await fetchWithTimeout(
                `${API_URL}/status`,
                undefined,
                STATUS_REQUEST_TIMEOUT_MS,
            );
            if (!statusRes.ok) {
                throw new Error(`HTTP error! status: ${statusRes.status}`);
            }

            const statusData = await statusRes.json();
            const cropStatus = statusData?.greenhouses?.[cropKey];
            // A stopped/completed/error replay requires an explicit user action. Only a
            // never-started crop may start automatically; recovery must preserve the dataset.
            if (cropStatus?.status !== 'idle') {
                return;
            }

            console.log(`Simulation for ${cropType} is ${cropStatus?.status ?? 'idle'}, starting...`);
            setTelemetryStateByCrop((prev) => ({
                ...prev,
                [cropType]: {
                    ...prev[cropType],
                    status: 'loading',
                },
            }));

            const startRes = await fetchWithTimeout(
                `${API_URL}/start`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        crop: cropKey,
                        csv_filename: cropStatus.csv_filename || (cropType === 'Tomato' ? 'Tomato_Env.CSV' : 'Cucumber_Env.CSV'),
                        time_step: '10min',
                    }),
                },
                START_REQUEST_TIMEOUT_MS,
            );
            if (!startRes.ok) {
                throw new Error(`HTTP error! status: ${startRes.status}`);
            }
            if (cropType === selectedCrop && isReconnectableSocket(wsRef.current)) {
                requestWebSocketReconnect(cropType);
            }
            console.log(`Simulation for ${cropType} started.`);
        } catch (err) {
            const errorName = err instanceof Error ? err.name : '';
            if (errorName === 'AbortError') {
                console.warn('Simulation startup request was aborted:', err);
                return;
            }
            console.error('Failed to ensure simulation is running:', err);
        } finally {
            recoveryRequestInFlightRef.current[cropType] = false;
        }
    }, [requestWebSocketReconnect, selectedCrop]);

    // Helper to map backend payload to frontend types
    const mapPayloadToData = useCallback((
        payload: BackendPayload,
        cropType: CropType,
        previousSensor: SensorData | null,
    ): {
        sensor: SensorData;
        metrics: AdvancedModelMetrics;
        metricPoint: MetricHistoryPoint;
        fieldAvailability: SensorFieldAvailability;
        fieldTimestamps: SensorFieldTimestamps;
    } => {
        const now = Date.now();
        const dataQuality = payload.data_quality ?? payload.state?.data_quality;
        const invalidInput = dataQuality?.status === 'invalid';
        const invalidModel = invalidInput || ['failed', 'unconverged', 'invalid_input'].includes(payload.state?.simulation_status ?? '');

        // Map Environment Data
        // Backend sends: T_air_C, RH_percent, CO2_ppm, PAR_umol, VPD_kPa
        const tsCandidate = payload.t
            ? new Date(payload.t).getTime()
            : (payload.state?.datetime ? new Date(payload.state.datetime).getTime() : now);
        const ts = Number.isFinite(tsCandidate) ? tsCandidate : now;

        const temperature = pickNumericValue(
            [payload.env?.T_air_C, payload.state?.T_air_C],
            previousSensor?.temperature ?? 0,
        );
        const canopyTemp = pickNumericValue(
            [payload.state?.T_canopy_C, payload.env?.T_air_C],
            previousSensor?.canopyTemp ?? temperature.value,
        );
        const humidity = pickNumericValue(
            [payload.env?.RH_percent],
            previousSensor?.humidity ?? 0,
        );
        const co2 = pickNumericValue(
            [payload.env?.CO2_ppm],
            previousSensor?.co2 ?? 400,
        );
        const light = pickNumericValue(
            [payload.env?.PAR_umol],
            previousSensor?.light ?? 0,
        );
        const soilMoisture = pickNumericValue(
            [payload.env?.soil_moisture_pct],
            previousSensor?.soilMoisture ?? 60,
        );
        const vpd = pickNumericValue(
            [payload.env?.VPD_kPa],
            previousSensor?.vpd ?? 0,
        );
        const transpiration = pickNumericValue(
            [payload.kpi?.transpiration_mm_h],
            previousSensor?.transpiration ?? 0,
        );
        const stomatalConductance = pickNumericValue(
            [payload.kpi?.stomatal_conductance],
            previousSensor?.stomatalConductance ?? 0,
        );
        const photosynthesis = pickNumericValue(
            [
                payload.flux?.gross_photosynthesis_umol_m2_s,
                payload.state?.gross_photosynthesis_umol_m2_s,
            ],
            previousSensor?.photosynthesis ?? 0,
        );
        const hFlux = pickNumericValue(
            [payload.flux?.H_W_m2, payload.state?.H_W_m2],
            previousSensor?.hFlux ?? 0,
        );
        const leFlux = pickNumericValue(
            [payload.flux?.LE_W_m2, payload.state?.LE_W_m2],
            previousSensor?.leFlux ?? 0,
        );
        const energyUsage = pickNumericValue(
            [payload.energy?.P_elec_kW],
            previousSensor?.energyUsage ?? 0,
        );

        const previousFieldTimestamps =
            previousSensor?.fieldTimestamps ?? DEFAULT_SENSOR_FIELD_TIMESTAMPS;
        const fieldAvailability: SensorFieldAvailability = {
            temperature: temperature.available && !invalidInput,
            humidity: humidity.available && !invalidInput,
            co2: co2.available && !invalidInput,
            light: light.available && !invalidInput,
            vpd: vpd.available && !invalidInput,
            stomatalConductance: stomatalConductance.available && !invalidModel,
            soilMoisture: soilMoisture.available && !invalidInput,
            canopyTemp: canopyTemp.available && !invalidModel,
            transpiration: transpiration.available && !invalidModel,
            photosynthesis: photosynthesis.available && !invalidModel,
            energyUsage: energyUsage.available && !invalidInput,
            hFlux: hFlux.available && !invalidModel,
            leFlux: leFlux.available && !invalidModel,
        };
        const fieldTimestamps: SensorFieldTimestamps = {
            temperature: temperature.available ? now : previousFieldTimestamps.temperature,
            humidity: humidity.available ? now : previousFieldTimestamps.humidity,
            co2: co2.available ? now : previousFieldTimestamps.co2,
            light: light.available ? now : previousFieldTimestamps.light,
            vpd: vpd.available ? now : previousFieldTimestamps.vpd,
            stomatalConductance: stomatalConductance.available
                ? now
                : previousFieldTimestamps.stomatalConductance,
        };

        const sensor: SensorData = {
            timestamp: ts,
            receivedAtTimestamp: now,
            temperature: temperature.value,
            canopyTemp: canopyTemp.value,
            humidity: humidity.value,
            co2: co2.value,
            light: light.value,
            soilMoisture: soilMoisture.value,
            vpd: vpd.value,
            transpiration: transpiration.value,
            stomatalConductance: stomatalConductance.value,
            photosynthesis: photosynthesis.value,
            hFlux: hFlux.value,
            leFlux: leFlux.value,
            energyUsage: energyUsage.value,
            fieldAvailability,
            fieldTimestamps,
            dataQuality,
            simulationStatus: payload.state?.simulation_status,
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
        const growthRate = typeof payload.kpi?.daily_fruit_growth_g_m2 === 'number'
            && Number.isFinite(payload.kpi.daily_fruit_growth_g_m2)
            ? payload.kpi.daily_fruit_growth_g_m2
            : 0;

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
                predictedWeekly: 0,
                predictionAvailable: false,
                confidence: payload.kpi?.yield_confidence ?? 0,
                harvestableFruits: state.n_fruits ?? 0
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
            metrics,
            receivedAtTimestamp: now,
            lai: metrics.growth.lai,
            biomass: metrics.growth.biomass,
            growthRate: metrics.growth.growthRate,
            activeTrusses: metrics.growth.activeTrusses,
            nodeCount: metrics.growth.nodeCount,
            sourceCapacity: !invalidModel && typeof state.source_capacity === 'number' ? state.source_capacity : undefined,
            sinkDemand: !invalidModel && typeof state.sink_demand === 'number' ? state.sink_demand : undefined,
            sourceSinkBalance: !invalidModel && typeof state.source_sink_balance === 'number' ? state.source_sink_balance : undefined,
            photosynthesis: sensor.photosynthesis,
            predictedWeeklyYield: metrics.yield.predictedWeekly,
            harvestableFruits: metrics.yield.harvestableFruits,
            energyConsumption: metrics.energy.consumption,
            energyLoadKw: metrics.energy.loadKw ?? metrics.energy.consumption,
            energyEfficiency: metrics.energy.efficiency,
        };

        return { sensor, metrics, metricPoint, fieldAvailability, fieldTimestamps };
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
            setSensorFieldAvailabilityByCrop(prev => {
                const next = liveState.sensorFieldAvailabilityByCrop[cropType];
                return prev[cropType] === next
                    ? prev
                    : {
                        ...prev,
                        [cropType]: next,
                    };
            });
            setSensorFieldTimestampsByCrop(prev => {
                const next = liveState.sensorFieldTimestampsByCrop[cropType];
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
            setTelemetryStateByCrop((prev) => ({
                ...prev,
                [cropAtConnection]: {
                    ...prev[cropAtConnection],
                    status: 'loading',
                },
            }));
            void applyStoredSimulationPace(cropAtConnection);
        };

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                const liveState = liveStateRef.current;
                const previousSensor = liveState.currentDataByCrop[cropAtConnection];
                const { sensor, metrics, metricPoint, fieldAvailability, fieldTimestamps } = mapPayloadToData(
                    payload,
                    cropAtConnection,
                    previousSensor,
                );
                if (previousSensor && sensor.timestamp < previousSensor.timestamp) {
                    liveState.historyByCrop[cropAtConnection] = [];
                    liveState.metricHistoryByCrop[cropAtConnection] = [];
                    liveState.startTimestampByCrop[cropAtConnection] = null;
                    setForecastByCrop(prev => ({ ...prev, [cropAtConnection]: null }));
                }
                liveState.currentDataByCrop[cropAtConnection] = sensor;
                liveState.modelMetricsByCrop[cropAtConnection] = metrics;
                liveState.sensorFieldAvailabilityByCrop[cropAtConnection] = fieldAvailability;
                liveState.sensorFieldTimestampsByCrop[cropAtConnection] = fieldTimestamps;
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
                setTelemetryStateByCrop((prev) => ({
                    ...prev,
                    [cropAtConnection]: {
                        status: 'live',
                        lastMessageAt: now,
                    },
                }));

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
            setTelemetryStateByCrop((prev) => ({
                ...prev,
                [cropAtConnection]: {
                    ...prev[cropAtConnection],
                    status: 'offline',
                },
            }));
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
            if (ws.readyState < WebSocket.CLOSING) {
                closedByCleanup = true;
                ws.close();
            }
            if (wsRef.current === ws) {
                wsRef.current = null;
            }
        };
    }, [applyStoredSimulationPace, flushCropState, mapPayloadToData, selectedCrop, wsConnectionNonce]);

    useEffect(() => {
        const cropAtConnection = selectedCrop;
        const cropPath = cropAtConnection.toLowerCase();
        const ws = new WebSocket(`${FORECAST_WS_URL}/${cropPath}`);
        let closedByCleanup = false;

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data) as ForecastSocketPayload;
                if (payload.type === 'forecast.error') {
                    setForecastByCrop(prev => ({ ...prev, [cropAtConnection]: {
                        ...(prev[cropAtConnection] ?? { daily: [], total_harvest_kg: null, total_ETc_mm: null, total_energy_kWh: null }),
                        refresh_error: locale === 'ko' ? '예측을 갱신하지 못했습니다.' : 'Forecast could not be refreshed.',
                    } }));
                    return;
                }
                const forecastSnapshot = normalizeForecastPayload(payload);
                if (!forecastSnapshot) {
                    return;
                }
                setForecastByCrop(prev => ({
                    ...prev,
                    [cropAtConnection]: forecastSnapshot,
                }));
            } catch (err) {
                console.error(`Error parsing forecast WS message for ${cropAtConnection}:`, err);
            }
        };

        ws.onerror = (error) => {
            if (closedByCleanup || ws.readyState >= WebSocket.CLOSING) {
                return;
            }
            console.error(`Forecast WebSocket error for ${cropAtConnection}:`, error);
        };

        return () => {
            closedByCleanup = true;
            if (ws.readyState < WebSocket.CLOSING) {
                ws.close();
            }
        };
    }, [selectedCrop, locale]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            const current = telemetryStateRef.current[selectedCrop];
            if (!current) {
                return;
            }

            let shouldRecover = false;
            let nextStatus = current.status;

            if (current.status === 'offline') {
                shouldRecover = true;
            } else if (current.lastMessageAt === null) {
                shouldRecover = current.status === 'loading';
            } else {
                const ageMs = Date.now() - current.lastMessageAt;
                nextStatus =
                    ageMs > STREAM_STALE_THRESHOLD_MS
                        ? 'stale'
                        : ageMs > STREAM_DELAY_THRESHOLD_MS
                            ? 'delayed'
                            : 'live';
                shouldRecover = ageMs > STREAM_STALE_THRESHOLD_MS;
            }

            if (nextStatus !== current.status) {
                setTelemetryStateByCrop((prev) => ({
                    ...prev,
                    [selectedCrop]: {
                        ...prev[selectedCrop],
                        status: nextStatus,
                    },
                }));
            }

            if (shouldRecover) {
                const lastAttemptAt = recoveryAttemptAtRef.current[selectedCrop];
                if (Date.now() - lastAttemptAt >= SIMULATION_RECOVERY_BACKOFF_MS) {
                    void ensureSimulationRunning(selectedCrop);
                }
            }
        }, TELEMETRY_HEALTH_POLL_MS);

        return () => window.clearInterval(timer);
    }, [ensureSimulationRunning, selectedCrop]);

    // Restore crop-specific controls when the user switches crop tabs
    useEffect(() => {
        setControls({
            ventilation: false,
            irrigation: false,
            heating: false,
            shading: false,
            settings: settingsByCropRef.current[selectedCrop],
            settingsState: 'loading',
            settingsError: null,
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
        let cancelled = false;
        const initialSettings = settingsByCropRef.current[selectedCrop];
        void (async () => {
            try {
                const response = await fetchWithTimeout(`${API_URL}/config/ops?crop=${cropKey}`, undefined, STATUS_REQUEST_TIMEOUT_MS);
                if (!response.ok) throw new Error('설정 불러오기 실패');
                const ops = await response.json();
                if (!Number.isFinite(ops.heating_set_C) || !Number.isFinite(ops.cooling_set_C)) throw new Error('설정 응답을 확인할 수 없습니다.');
                if (cancelled || initialSettings !== settingsByCropRef.current[selectedCrop]) return;
                const settings: TemperatureSettings = {
                    heating: ops.heating_set_C, cooling: ops.cooling_set_C,
                    pBand: ops.p_band_C, co2Target: ops.co2_target_ppm, drainTarget: ops.drain_target_fraction,
                };
                settingsByCropRef.current[selectedCrop] = settings;
                setControls(prev => ({ ...prev, settings, settingsState: 'ready', settingsError: null }));
            } catch {
                if (!cancelled) setControls(prev => ({ ...prev, settingsState: 'error', settingsError: '현재 설정을 불러오지 못했습니다. 연결 상태를 확인하세요.' }));
            }
        })();
        return () => { cancelled = true; };
    }, [selectedCrop]);

    // Start simulation for the selected crop on mount and crop changes.
    useEffect(() => {
        void ensureSimulationRunning(selectedCrop);
    }, [ensureSimulationRunning, selectedCrop]);

    const toggleControl = useCallback((key: keyof ControlStatus) => {
        setControls(prev => ({ ...prev, [key]: !prev[key] }));
        // Note: These controls are local overrides for visualization. 
        // The backend simulation runs in automatic mode based on setpoints.
    }, []);

    const setControlValue = useCallback((key: keyof ControlStatus, value: boolean) => {
        setControls(prev => ({ ...prev, [key]: value }));
    }, []);

    const setTempSettings = useCallback(async (newSettings: TemperatureSettings) => {
        const cropAtRequest = selectedCrop;
        const cropKey = cropAtRequest.toLowerCase();
        if (newSettings.heating >= newSettings.cooling) {
            throw new Error(locale === 'ko' ? '난방 기준은 냉방 기준보다 낮아야 합니다.' : 'Heating must be below cooling.');
        }

        try {
            const res = await fetchWithTimeout(`${API_URL}/config/ops?crop=${cropKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    heating_set_C: newSettings.heating,
                    cooling_set_C: newSettings.cooling,
                    p_band_C: newSettings.pBand ?? settingsByCropRef.current[selectedCrop].pBand ?? 4.0,
                    co2_target_ppm: newSettings.co2Target ?? settingsByCropRef.current[selectedCrop].co2Target ?? 800,
                    drain_target_fraction: newSettings.drainTarget ?? settingsByCropRef.current[selectedCrop].drainTarget ?? 0.3,
                })
            }, START_REQUEST_TIMEOUT_MS);
            if (!res.ok) {
                throw new Error(locale === 'ko' ? '설정을 적용하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.' : 'Settings were not applied. Check the connection and retry.');
            }
            settingsByCropRef.current[cropAtRequest] = newSettings;
            setControls(prev => cropAtRequest === selectedCropRef.current
                ? { ...prev, settings: newSettings, settingsState: 'ready', settingsError: null }
                : prev);
        } catch (err) {
            throw err instanceof Error ? err : new Error('Settings were not applied.');
        }
    }, [selectedCrop, locale]);

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
        energyUsage: 0,
        fieldAvailability: { ...DEFAULT_SENSOR_FIELD_AVAILABILITY },
        fieldTimestamps: { ...DEFAULT_SENSOR_FIELD_TIMESTAMPS },
    };
    const forecastDays = forecastByCrop[selectedCrop]?.daily?.length ?? 0;
    const forecastRefreshMs = forecastDays > 0 ? 60000 : 5000;

    // Fetch forecast for the active crop with stale-request protection
    const fetchForecast = useCallback(async (cropOverride?: CropType) => {
        const cropType = cropOverride ?? selectedCrop;
        const requestId = forecastRequestIdRef.current[cropType] + 1;
        forecastRequestIdRef.current[cropType] = requestId;

        try {
            const cropKey = cropType.toLowerCase();
            const res = await fetchWithTimeout(`${API_URL}/forecast/${cropKey}`, undefined, START_REQUEST_TIMEOUT_MS);
            if (!res.ok) throw new Error('예측 갱신 실패: 연결 상태를 확인하세요.');
            if (res.ok) {
                const data = await res.json();
                if (forecastRequestIdRef.current[cropType] !== requestId) {
                    return;
                }
                setForecastByCrop(prev => ({
                    ...prev,
                    [cropType]: { ...data, refreshed_at: new Date().toISOString(), refresh_error: null },
                }));
            }
        } catch (err) {
            if (forecastRequestIdRef.current[cropType] !== requestId) return;
            const refreshError = err instanceof Error && err.name !== 'AbortError' ? err.message : '예측 응답이 지연되고 있습니다.';
            setForecastByCrop(prev => ({ ...prev, [cropType]: {
                ...(prev[cropType] ?? { daily: [], total_harvest_kg: null, total_ETc_mm: null, total_energy_kWh: null }),
                refresh_error: refreshError,
            } }));
        }
    }, [selectedCrop]);

    // Initial fetch and periodic update for forecast
    useEffect(() => {
        void fetchForecast(selectedCrop);
        const interval = window.setInterval(() => {
            void fetchForecast(selectedCrop);
        }, forecastRefreshMs);
        return () => clearInterval(interval);
    }, [fetchForecast, forecastRefreshMs, selectedCrop]);

    const currentData = currentDataByCrop[selectedCrop];
    const history = historyByCrop[selectedCrop];
    const metricHistory = metricHistoryByCrop[selectedCrop];
    const forecast = forecastByCrop[selectedCrop];
    const startTimestamp = startTimestampByCrop[selectedCrop];
    const sensorFieldAvailability =
        sensorFieldAvailabilityByCrop[selectedCrop] ?? DEFAULT_SENSOR_FIELD_AVAILABILITY;
    const sensorFieldTimestamps =
        sensorFieldTimestampsByCrop[selectedCrop] ?? DEFAULT_SENSOR_FIELD_TIMESTAMPS;

    // Derived timeline labels
    const currentTimestamp = currentData?.timestamp ?? Date.now();
    const growthDay = startTimestamp
        ? Math.max(1, Math.floor((currentTimestamp - startTimestamp) / (1000 * 60 * 60 * 24)) + 1)
        : null;
    const startDateLabel = startTimestamp ? formatLocaleDate(locale, startTimestamp) : null;
    const currentDateLabel = formatLocaleDateTime(locale, currentTimestamp);

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
        telemetry: telemetryStateByCrop[selectedCrop],
        sensorFieldAvailability,
        sensorFieldTimestamps,
        currentData: currentData || defaultData,
        modelMetrics: {
            ...selectedMetrics,
            yield: {
                ...selectedMetrics.yield,
                predictedWeekly: forecast?.total_harvest_kg ?? 0,
                predictionAvailable: typeof forecast?.total_harvest_kg === 'number',
                dryMatterGrowthKg: forecast?.total_fruit_growth_dry_kg ?? null,
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
        currentDateLabel,
    };
};
