export type CropType = 'Tomato' | 'Cucumber';

export type TelemetryStatus = 'loading' | 'live' | 'delayed' | 'stale' | 'offline';
export type SensorFieldState = 'live' | 'delayed' | 'stale' | 'offline' | 'missing';
export type SensorFieldKey =
    | 'temperature'
    | 'humidity'
    | 'co2'
    | 'light'
    | 'vpd'
    | 'stomatalConductance';

export type SensorFieldAvailability = Record<SensorFieldKey, boolean>;
export type SensorFieldTimestamps = Record<SensorFieldKey, number | null>;

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
    fieldAvailability?: SensorFieldAvailability;
    fieldTimestamps?: SensorFieldTimestamps;
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

export type ProducePriceDirection = 'up' | 'down' | 'flat';
export type ProducePriceAuthMode = 'sample' | 'configured';
export type ProduceMarketKey = 'retail' | 'wholesale';

export interface ProducePriceEntry {
    key: string;
    display_name: string;
    source_name: string;
    category_name: string;
    market_label: string;
    unit: string;
    latest_day: string;
    current_price_krw: number;
    previous_day_price_krw: number;
    month_ago_price_krw: number;
    year_ago_price_krw: number;
    direction: ProducePriceDirection;
    day_over_day_pct: number;
    raw_day_over_day_pct: number;
}

export interface ProducePriceTrendPoint {
    date: string;
    segment: 'history' | 'forecast';
    actual_price_krw: number | null;
    normal_3y_price_krw: number | null;
    normal_5y_price_krw: number | null;
    normal_10y_price_krw: number | null;
    normal_3y_sample_count: number;
    normal_5y_sample_count: number;
    normal_10y_sample_count: number;
}

export interface ProducePriceTrendSeries {
    key: string;
    display_name: string;
    source_name: string;
    unit: string;
    reference_date: string;
    history_days: number;
    forecast_days: number;
    points: ProducePriceTrendPoint[];
}

export interface ProducePriceTrendUnavailable {
    key: string;
    display_name: string;
    reason: string;
}

export interface ProduceMarketSnapshot {
    market_key: ProduceMarketKey;
    market_label: string;
    summary: string;
    items: ProducePriceEntry[];
}

export interface ProducePricesPayload {
    source: {
        provider: string;
        docs_url: string;
        endpoint: string;
        auth_mode: ProducePriceAuthMode;
        fetched_at: string;
        latest_day: string;
    };
    summary: string;
    items: ProducePriceEntry[];
    markets: Record<ProduceMarketKey, ProduceMarketSnapshot>;
    trend: {
        market_key: ProduceMarketKey;
        reference_date: string;
        history_days: number;
        forecast_days: number;
        normal_year_windows: number[];
        series: ProducePriceTrendSeries[];
        unavailable_series: ProducePriceTrendUnavailable[];
    };
}

export type RtrCalibrationMode = 'baseline' | 'fitted' | 'insufficient-data';
export type RtrSurfaceMode = 'baseline' | 'optimizer';
export type RtrOptimizationMode =
    | 'growth_priority'
    | 'balanced'
    | 'energy_saving'
    | 'labor_saving'
    | 'custom_weights';

export interface RtrBaselineProfile {
    baseTempC: number;
    slopeCPerMjM2: number;
    toleranceC: number;
}

export interface RtrOptimizerWeights {
    temp: number;
    node: number;
    carbon: number;
    sink: number;
    resp: number;
    risk: number;
    energy: number;
    labor: number;
}

export interface RtrOptimizerProfileConfig {
    enabled: boolean;
    default_mode: RtrOptimizationMode;
    max_delta_temp_C: number;
    max_rtr_ratio_delta: number;
    temp_slew_rate_C_per_step: number;
    weights: RtrOptimizerWeights;
}

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

export interface RtrProfile extends RtrBaselineProfile {
    crop: CropType;
    strategyLabel: string;
    sourceNote: string;
    lightToRadiantDivisor: number;
    calibration: RtrCalibrationMetadata;
    baseline?: RtrBaselineProfile;
    optimizer?: RtrOptimizerProfileConfig;
}

export interface RtrProfilesPayload {
    version: number;
    updatedAt: string;
    status?: string;
    mode?: RtrSurfaceMode;
    optimizerEnabled?: boolean;
    availableModes?: RtrSurfaceMode[];
    profiles: Record<CropType, RtrProfile>;
}

export interface RtrAreaUnitMeta {
    greenhouse_area_m2: number;
    actual_area_m2: number;
    actual_area_pyeong: number;
}

export interface RtrControlTargets {
    day_min_temp_C: number;
    night_min_temp_C: number;
    mean_temp_C: number;
    vent_bias_C: number;
    screen_bias_pct: number;
    co2_target_ppm: number;
}

export interface RtrObjectiveBreakdown {
    assimilation_gain: number;
    respiration_cost: number;
    node_target_penalty: number;
    carbon_margin_penalty: number;
    sink_overload_penalty: number;
    humidity_risk_penalty: number;
    disease_penalty: number;
    energy_cost: number;
    energy_cost_krw: number;
    labor_cost: number;
    labor_index: number;
}

export interface RtrFeasibility {
    target_node_hit: boolean;
    carbon_margin_positive: boolean;
    risk_flags: Array<Record<string, unknown>>;
    confidence?: number;
}

export interface RtrCanonicalState {
    timestamp?: string;
    crop: string;
    greenhouse_id?: string;
    env: {
        T_air_C: number;
        T_canopy_C: number;
        RH_pct: number;
        VPD_kPa: number;
        CO2_ppm: number;
        PAR_umol_m2_s: number;
        outside_T_C: number;
    };
    flux: {
        gross_assim_umol_m2_s: number;
        net_assim_umol_m2_s: number;
        respiration_proxy_umol_m2_s: number;
        transpiration_g_m2_s: number;
        latent_heat_W_m2: number;
        sensible_heat_W_m2: number;
        stomatal_conductance_m_s: number;
    };
    growth: {
        LAI: number;
        node_count: number;
        predicted_node_rate_day: number;
        fruit_load: number;
        sink_demand: number;
        source_capacity: number;
        vegetative_dry_matter_g_m2: number;
        fruit_dry_matter_g_m2: number;
        harvested_fruit_dry_matter_g_m2: number;
    };
    crop_specific: {
        cucumber?: {
            leaf_area_by_rank: number[];
            upper_leaf_activity: number;
            middle_leaf_activity: number;
            bottom_leaf_activity: number;
            remaining_leaves: number;
        };
        tomato?: {
            truss_cohorts: Array<Record<string, unknown>>;
            active_trusses: number;
            fruit_partition_ratio: number;
            upper_leaf_activity?: number;
            middle_leaf_activity?: number;
            bottom_leaf_activity?: number;
        };
    };
    energy: {
        Q_load_kW: number;
        P_elec_kW: number;
        COP_current: number;
        daily_kWh: number;
    };
    events: {
        recent_leaf_removal: Array<Record<string, unknown>>;
        recent_fruit_thinning: Array<Record<string, unknown>>;
        recent_harvest: Array<Record<string, unknown>>;
        recent_setpoint_changes: Array<Record<string, unknown>>;
    };
    baseline_rtr: {
        baseTempC: number;
        slopeCPerMjM2: number;
        baseline_target_C: number;
    };
    optimizer?: RtrOptimizerProfileConfig;
}

export interface RtrStateResponse {
    status: string;
    crop: CropType;
    greenhouse_id: string;
    snapshot_id: string;
    canonical_state: RtrCanonicalState;
    baseline_rtr: RtrCanonicalState['baseline_rtr'];
    optimizer_enabled: boolean;
    area_unit_meta: RtrAreaUnitMeta;
}

export interface RtrEquivalentSummary {
    baseline_ratio: number;
    optimized_ratio: number;
    delta_ratio: number;
    delta_temp_C: number;
}

export interface RtrFluxProjection {
    gross_assim_umol_m2_s: number;
    net_assim_umol_m2_s: number;
    respiration_umol_m2_s: number;
    carbon_margin: number;
    day_Q_load_kW: number;
    night_Q_load_kW: number;
    stomatal_conductance_m_s: number;
}

export interface RtrCropSpecificInsight {
    crop: 'cucumber' | 'tomato';
    remaining_leaves?: number;
    leaf_area_by_rank?: number[];
    layer_activity: {
        upper: number;
        middle: number;
        bottom: number;
    };
    bottleneck_layer?: 'upper' | 'middle' | 'bottom';
    recent_leaf_removal_count?: number;
    active_trusses?: number;
    fruit_partition_ratio?: number;
    dominant_cohort_id?: number | null;
    dominant_cohort_sink?: number;
    recent_fruit_thinning_count?: number;
}

export interface RtrExplanationPayload {
    summary: string;
    target_node_development_per_day: number;
    baseline_mean_temp_C: number;
    optimized_mean_temp_C: number;
    reason_tags: string[];
    crop_summary: string;
    missing_work_event_warning?: string | null;
}

export interface RtrControlGuidance {
    target_horizon: 'today' | 'next_24h' | 'day+night split';
    day_hold_hours: number;
    night_hold_hours: number;
    change_limit_C_per_step: number;
    max_delta_temp_C: number;
    max_rtr_ratio_delta: number;
}

export interface RtrUnitsM2Projection {
    greenhouse_area_m2: number;
    actual_area_m2: number;
    actual_area_pyeong: number;
    yield_proxy_kg_m2_day: number;
    yield_proxy_kg_m2_week: number;
    energy_kwh_m2_day: number;
    energy_krw_m2_day: number;
    labor_index_m2_day: number;
    node_development_day: number;
}

export interface RtrActualAreaProjection {
    actual_area_m2: number;
    actual_area_pyeong: number;
    yield_kg_day: number;
    yield_kg_week: number;
    energy_kwh_day: number;
    energy_krw_day: number;
    labor_index_day: number;
}

export interface RtrOptimizeResponse {
    status: string;
    mode: RtrSurfaceMode;
    crop: CropType;
    greenhouse_id: string;
    snapshot_id: string;
    baseline: {
        mode: 'baseline';
        targets: RtrControlTargets;
        objective_breakdown: RtrObjectiveBreakdown;
        feasibility: RtrFeasibility;
    };
    optimal_targets: RtrControlTargets;
    rtr_equivalent: RtrEquivalentSummary;
    objective_breakdown: RtrObjectiveBreakdown;
    feasibility: RtrFeasibility;
    flux_projection: RtrFluxProjection;
    crop_specific_insight: RtrCropSpecificInsight;
    warning_badges: string[];
    units_m2: RtrUnitsM2Projection;
    actual_area_projection: RtrActualAreaProjection;
    explanation_payload: RtrExplanationPayload;
    control_guidance: RtrControlGuidance;
    solver: {
        success: boolean;
        message: string;
        method: string;
        stage1_success?: boolean;
        stage2_success?: boolean;
        stage1_message?: string;
        stage2_message?: string;
    };
}

export interface RtrScenarioRow {
    label: string;
    mode: RtrSurfaceMode | 'custom';
    mean_temp_C: number;
    day_min_temp_C: number;
    night_min_temp_C: number;
    node_rate_day: number;
    net_carbon: number;
    respiration: number;
    energy_kwh_m2_day: number;
    labor_index: number;
    yield_kg_m2_day: number;
    yield_kg_m2_week: number;
    yield_trend: string;
    recommendation_badge: string;
    confidence: number;
    risk_flags: Array<Record<string, unknown>>;
    objective_breakdown: RtrObjectiveBreakdown;
    actual_area_projection?: RtrActualAreaProjection;
}

export interface RtrScenarioResponse {
    status: string;
    crop: CropType;
    greenhouse_id: string;
    snapshot_id: string;
    target_node_development_per_day: number;
    scenarios: RtrScenarioRow[];
    area_unit_meta: RtrAreaUnitMeta;
}

export interface RtrSensitivityEntry {
    sensitivity_id?: string;
    control: string;
    target: string;
    derivative: number;
    elasticity: number;
    direction: 'increase' | 'decrease';
    trust_region: {
        low: number;
        high: number;
    };
    method: string;
    perturbation_size: number;
    valid: boolean;
    scenario_alignment: boolean;
    created_at?: string;
}

export interface RtrSensitivityResponse {
    status: string;
    mode: RtrSurfaceMode;
    crop: CropType;
    greenhouse_id: string;
    snapshot_id: string;
    target_horizon: string;
    step_c: number;
    sensitivities: RtrSensitivityEntry[];
    optimized_targets: RtrControlTargets;
    area_unit_meta: RtrAreaUnitMeta;
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
