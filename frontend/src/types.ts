export type CropType = 'Tomato' | 'Cucumber';

export interface SensorData {
    timestamp: number;
    temperature: number;
    canopyTemp: number;
    humidity: number;
    co2: number;
    light: number;
    soilMoisture: number;
    vpd: number;
    transpiration: number;
    stomatalConductance: number;
    photosynthesis: number;
    hFlux: number;
    leFlux: number;
    energyUsage: number;
}

export interface TemperatureSettings {
    heating: number;
    cooling: number;
}

export interface ControlStatus {
    ventilation: boolean;
    irrigation: boolean;
    heating: boolean;
    shading: boolean;
    settings: TemperatureSettings;
}

export interface AdvancedModelMetrics {
    cropType: CropType;
    growth: {
        lai: number;
        biomass: number;
        developmentStage: string;
        growthRate: number;
        activeTrusses?: number;
        nodeCount?: number;
    };
    yield: {
        predictedWeekly: number;
        confidence: number;
        harvestableFruits: number;
    };
    energy: {
        /** Electrical power consumption (kW) */
        consumption: number;
        /** Estimated energy cost per hour (currency/h) */
        costPrediction: number;
        efficiency: number;
        /** Thermal load (kW), if available */
        loadKw?: number;
        /** HVAC operating mode (heating/cooling/off), if available */
        mode?: string;
    };
}

export interface ForecastDay {
    date: string;
    harvest_kg: number;
    ETc_mm: number;
}

export interface ForecastData {
    daily: ForecastDay[];
    total_harvest_kg: number;
    total_ETc_mm: number;
    total_energy_kWh: number;
}

export interface WeatherCurrent {
    time: string;
    weather_code: number;
    weather_label: string;
    temperature_c: number;
    apparent_temperature_c: number;
    relative_humidity_pct: number;
    precipitation_mm: number;
    cloud_cover_pct: number;
    wind_speed_kmh: number;
    wind_direction_deg: number;
    is_day: boolean;
}

export interface WeatherForecastDay {
    date: string;
    weather_code: number;
    weather_label: string;
    temperature_max_c: number;
    temperature_min_c: number;
    shortwave_radiation_sum_mj_m2: number;
    precipitation_probability_max_pct: number;
    precipitation_sum_mm: number;
    wind_speed_max_kmh: number;
    sunshine_duration_h: number;
}

export interface WeatherOutlook {
    location: {
        name: string;
        country: string;
        latitude: number;
        longitude: number;
        timezone: string;
    };
    source: {
        provider: string;
        docs_url: string;
        fetched_at: string;
    };
    summary: string;
    current: WeatherCurrent;
    daily: WeatherForecastDay[];
}

export type RtrCalibrationMode = 'baseline' | 'fitted' | 'insufficient-data';

export interface RtrCalibrationMetadata {
    mode: RtrCalibrationMode;
    sampleDays: number;
    fitStartDate: string | null;
    fitEndDate: string | null;
    minCoverageHours: number;
    rSquared: number | null;
    meanAbsoluteErrorC: number | null;
    selectionSource?: 'curated-windows' | 'heuristic-fallback';
    windowCount?: number;
}

export interface RtrProfile {
    crop: CropType;
    strategyLabel: string;
    sourceNote: string;
    baseTempC: number;
    slopeCPerMjM2: number;
    toleranceC: number;
    lightToRadiantDivisor: number;
    calibration: RtrCalibrationMetadata;
}

export interface RtrProfilesPayload {
    version: number;
    updatedAt: string;
    profiles: Record<CropType, RtrProfile>;
}

export interface MetricHistoryPoint {
    timestamp: number;
    lai: number;
    biomass: number;
    growthRate: number;
    predictedWeeklyYield: number;
    harvestableFruits: number;
    energyConsumption: number;
    energyLoadKw: number;
    energyEfficiency: number;
}

export type TrendLabel = 'up' | 'down' | 'flat';

export interface VariableSummary {
    first: number;
    last: number;
    min: number;
    max: number;
    mean: number;
    delta: number;
    slope_per_h: number;
    max_step_abs: number;
    trend: TrendLabel;
}

/**
 * Compact summary of the most recent time series (typically last 60 points).
 * Designed to be sent to LLMs instead of raw arrays.
 */
export interface RecentSeriesSummary {
    n: number;
    start_ts: number;
    end_ts: number;
    duration_min: number;
    avg_dt_min: number;
    variables: Record<string, VariableSummary>;
}
