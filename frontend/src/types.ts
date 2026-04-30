export type CropType = 'Tomato' | 'Cucumber';
export type CropApiKey = Lowercase<CropType>;

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
    receivedAtTimestamp?: number;
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
    pBand?: number;
    co2Target?: number;
    drainTarget?: number;
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
    type?: 'forecast.snapshot';
    daily: ForecastDay[];
    last?: Record<string, unknown>;
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

export interface OverviewSignalPoint {
    time: string;
}

export interface OverviewIrradiancePoint extends OverviewSignalPoint {
    shortwave_radiation_w_m2: number;
}

export interface OverviewSourceSinkPoint extends OverviewSignalPoint {
    source_sink_balance: number;
    source_capacity: number;
    sink_demand: number;
}

export interface OverviewSignalHistory {
    source: {
        provider: string;
        docs_url?: string;
        endpoint?: string;
        fetched_at?: string;
    };
    unit: string;
    points: OverviewIrradiancePoint[];
    window_hours?: number;
}

export interface OverviewSourceSinkHistory {
    source: {
        provider: string;
    };
    unit: string;
    status: 'ready' | 'model_history_unavailable';
    points: OverviewSourceSinkPoint[];
}

export interface OverviewSignalsPayload {
    status: string;
    crop: string;
    greenhouse_id: string;
    window_hours: number;
    irradiance: OverviewSignalHistory;
    source_sink: OverviewSourceSinkHistory;
}

export type ProducePriceDirection = 'up' | 'down' | 'flat';
export type ProducePriceAuthMode = 'sample' | 'configured' | 'fallback';
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
        status?: string;
        fallback_reason?: string | null;
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
    | 'custom_weights'
    | 'yield_priority'
    | 'energy_priority'
    | 'labor_priority'
    | 'cooling_saving'
    | 'heating_saving';

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
    assim: number;
    yield: number;
    heating: number;
    cooling: number;
    ventilation: number;
    humidity: number;
    disease: number;
    stress: number;
}

export interface RtrLaborBenchmark {
    source_key?: string;
    source_label_ko?: string;
    source_label_en?: string;
    source_note?: string;
    source_url?: string;
    reference_year?: number;
    reference_labor_hours_10a_year?: number;
    reference_workload_index?: number;
    default_labor_rate_krw_hour?: number;
    default_labor_rate_basis?: string;
}

export interface RtrOptimizerProfileConfig {
    enabled: boolean;
    default_mode: RtrOptimizationMode;
    max_delta_temp_C: number;
    max_rtr_ratio_delta: number;
    temp_slew_rate_C_per_step: number;
    weights: RtrOptimizerWeights;
    labor_benchmark?: RtrLaborBenchmark;
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

export type RtrCalibrationSelectionMode = 'auto' | 'windows-only' | 'heuristic-only';

export interface RtrCalibrationWindow {
    label?: string | null;
    startDate: string;
    endDate: string;
    enabled: boolean;
    notes?: string | null;
    houseId?: string | null;
    approvalStatus:
        | 'heuristic-demo'
        | 'concept-demo'
        | 'grower-approved'
        | 'manager-approved'
        | 'consultant-approved'
        | 'internal-review';
    approvalSource?: string | null;
    approvalReason?: string | null;
    evidenceNotes?: string | null;
}

export interface RtrCalibrationEnvironmentSummary {
    has_environment_history: boolean;
    start_date: string | null;
    end_date: string | null;
    total_rows: number;
    total_days: number;
}

export interface RtrCalibrationSelectionSummary {
    filtered_days: number;
    pre_filter_days: number;
    selection_source: 'curated-windows' | 'heuristic-fallback';
    window_count: number;
}

export interface RtrCalibrationStateResponse {
    status: string;
    crop: CropApiKey;
    greenhouse_id: string;
    current_profile: RtrProfile;
    windows: RtrCalibrationWindow[];
    environment_summary: RtrCalibrationEnvironmentSummary;
    available_selection_modes: RtrCalibrationSelectionMode[];
    selection_mode: RtrCalibrationSelectionMode;
}

export interface RtrCalibrationPreviewResponse {
    status: string;
    crop: CropApiKey;
    greenhouse_id: string;
    selection_mode: RtrCalibrationSelectionMode;
    windows: RtrCalibrationWindow[];
    preview_profile: RtrProfile;
    environment_summary: RtrCalibrationEnvironmentSummary;
    selection_summary: RtrCalibrationSelectionSummary;
    saved?: boolean;
    current_profile?: RtrProfile;
    config_paths?: {
        windows: string;
        profiles: string;
    };
}

export interface RtrAreaUnitMeta {
    greenhouse_area_m2: number;
    actual_area_m2: number;
    actual_area_pyeong: number;
}

export interface RtrActuatorAvailability {
    heating: boolean;
    cooling: boolean;
    ventilation: boolean;
    thermal_screen: boolean;
    circulation_fan: boolean;
    co2: boolean;
    dehumidification: boolean;
    fogging_or_evap_cooling: boolean;
    cooling_modes: string[];
}

export interface RtrControlTargets {
    day_min_temp_C: number;
    night_min_temp_C: number;
    mean_temp_C: number;
    day_heating_min_temp_C?: number;
    night_heating_min_temp_C?: number;
    day_cooling_target_C?: number;
    night_cooling_target_C?: number;
    vent_bias_C: number;
    screen_bias_pct: number;
    circulation_fan_pct?: number;
    co2_target_ppm: number;
    dehumidification_bias?: number;
    fogging_or_evap_cooling_intensity?: number;
}

export interface RtrObjectiveBreakdown {
    assimilation_gain: number;
    respiration_cost: number;
    node_target_penalty: number;
    carbon_margin_penalty: number;
    sink_overload_penalty: number;
    humidity_risk_penalty: number;
    disease_penalty: number;
    stress_penalty?: number;
    heating_energy_cost?: number;
    cooling_energy_cost?: number;
    ventilation_energy_cost?: number;
    energy_cost: number;
    energy_cost_krw: number;
    heating_energy_cost_krw?: number;
    cooling_energy_cost_krw?: number;
    ventilation_energy_cost_krw?: number;
    labor_cost: number;
    labor_cost_krw?: number;
    labor_objective_penalty?: number;
    labor_index: number;
    labor_hours_m2_day?: number;
    yield_penalty?: number;
    gross_margin_proxy_krw_m2_day?: number;
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
    crop: CropApiKey;
    greenhouse_id: string;
    snapshot_id: string;
    canonical_state: RtrCanonicalState;
    baseline_rtr: RtrCanonicalState['baseline_rtr'];
    optimizer_enabled: boolean;
    area_unit_meta: RtrAreaUnitMeta;
    actuator_availability?: RtrActuatorAvailability;
    optimizer_defaults?: RtrOptimizerProfileConfig;
    current_per_m_projections?: RtrUnitsM2Projection;
    current_actual_area_projection?: RtrActualAreaProjection;
    current_control_effect_trace?: RtrControlEffectTrace;
    current_risk_flags?: Array<Record<string, unknown>>;
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
    transpiration_g_m2_s?: number;
    latent_heat_W_m2?: number;
    sensible_heat_W_m2?: number;
    T_air_C?: number;
    T_leaf_C?: number;
    RH_pct?: number;
    VPD_kPa?: number;
    CO2_ppm?: number;
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
    development_metric?: 'node' | 'truss';
    temperature_development_rows?: Array<{
        mean_temp_C: number;
        development_rate_day: number;
    }>;
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
    heating_energy_kwh_m2_day?: number;
    cooling_energy_kwh_m2_day?: number;
    labor_index_m2_day: number;
    labor_hours_m2_day?: number;
    labor_cost_krw_m2_day?: number;
    node_development_day: number;
    gross_margin_proxy_krw_m2_day?: number;
}

export interface RtrActualAreaProjection {
    actual_area_m2: number;
    actual_area_pyeong: number;
    yield_kg_day: number;
    yield_kg_week: number;
    energy_kwh_day: number;
    energy_krw_day: number;
    heating_energy_kwh_day?: number;
    cooling_energy_kwh_day?: number;
    labor_index_day: number;
    labor_hours_day?: number;
    labor_cost_krw_day?: number;
    margin_krw_day?: number;
}

export interface RtrEnergySummary {
    heating_energy_kWh_m2_day: number;
    cooling_energy_kWh_m2_day: number;
    ventilation_energy_kWh_m2_day: number;
    total_energy_kWh_m2_day: number;
    heating_cost_krw_m2_day: number;
    cooling_cost_krw_m2_day: number;
    ventilation_cost_krw_m2_day: number;
    total_energy_cost_krw_m2_day: number;
}

export interface RtrLaborSummary {
    harvest_load_index: number;
    training_load_index: number;
    pruning_load_index: number;
    thinning_load_index: number;
    pollination_or_cluster_management_index: number;
    canopy_management_load_index: number;
    labor_index: number;
    labor_hours_m2_day: number;
    labor_cost_krw_m2_day: number;
    labor_rate_krw_hour?: number;
    labor_rate_source?: 'user' | 'agricultural-income-reference' | string;
    labor_hours_basis?: string;
    labor_benchmark_crop?: string;
    labor_benchmark_source_label_ko?: string;
    labor_benchmark_source_label_en?: string;
    labor_benchmark_source_note?: string;
    labor_benchmark_source_url?: string;
    reference_year?: number;
    reference_labor_hours_10a_year?: number;
    reference_workload_index?: number;
    reference_labor_hours_m2_day?: number;
    reference_labor_cost_krw_10a_year?: number;
    default_labor_rate_basis?: string;
    labor_reference_source?: string;
    definition?: string;
    predicted_harvest_frequency_increase?: number;
    predicted_pruning_thinning_demand_increase?: number;
}

export interface RtrYieldSummary {
    predicted_yield_kg_m2_day: number;
    predicted_yield_kg_m2_week: number;
    harvest_trend_delta_pct: number;
    gross_margin_proxy_krw_m2_day: number;
}

export interface RtrControlEffectTrace {
    day?: Record<string, number>;
    night?: Record<string, number>;
    env?: {
        Tin_post_C?: number;
        Tleaf_post_C?: number;
        RH_post_pct?: number;
        VPD_post_kPa?: number;
        CO2_post_ppm?: number;
        air_exchange_post?: number;
        H_post_W_m2?: number;
        LE_post_W_m2?: number;
        transpiration_post_g_m2_s?: number;
        condensation_risk_post?: number;
    };
}

export interface RtrOptimizeResponse {
    status: string;
    mode: RtrSurfaceMode;
    crop: CropApiKey;
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
    actuator_availability?: RtrActuatorAvailability;
    energy_summary?: RtrEnergySummary;
    labor_summary?: RtrLaborSummary;
    yield_summary?: RtrYieldSummary;
    control_effect_trace?: RtrControlEffectTrace;
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
        stage2_coordination?: string;
        coordinated_candidate?: Record<string, unknown>;
    };
}

export interface RtrScenarioRow {
    label: string;
    mode: RtrSurfaceMode | 'custom' | 'offset';
    group?: 'baseline' | 'hvac' | 'vent-screen' | 'optimizer';
    mean_temp_C: number;
    day_min_temp_C: number;
    night_min_temp_C: number;
    day_heating_min_temp_C?: number;
    night_heating_min_temp_C?: number;
    day_cooling_target_C?: number;
    night_cooling_target_C?: number;
    vent_bias_C?: number;
    screen_bias_pct?: number;
    circulation_fan_pct?: number;
    co2_target_ppm?: number;
    node_rate_day: number;
    net_carbon: number;
    net_assimilation?: number;
    respiration: number;
    humidity_penalty?: number;
    disease_penalty?: number;
    energy_kwh_m2_day: number;
    heating_energy_kwh_m2_day?: number;
    cooling_energy_kwh_m2_day?: number;
    total_energy_cost_krw_m2_day?: number;
    labor_index: number;
    labor_hours_m2_day?: number;
    labor_cost_krw_m2_day?: number;
    labor_summary?: RtrLaborSummary;
    yield_kg_m2_day: number;
    yield_kg_m2_week: number;
    harvest_trend_delta_pct?: number;
    yield_trend: string;
    recommendation_badge: string;
    confidence: number;
    risk_flags: Array<Record<string, unknown>>;
    objective_breakdown: RtrObjectiveBreakdown;
    actual_area_projection?: RtrActualAreaProjection;
    control_effect_trace?: RtrControlEffectTrace;
}

export interface RtrScenarioResponse {
    status: string;
    crop: CropApiKey;
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
    crop: CropApiKey;
    greenhouse_id: string;
    snapshot_id: string;
    target_horizon: string;
    step_c: number;
    sensitivities: RtrSensitivityEntry[];
    optimized_targets: RtrControlTargets;
    area_unit_meta: RtrAreaUnitMeta;
    actuator_availability?: RtrActuatorAvailability;
}

export interface MetricHistoryPoint {
    timestamp: number;
    receivedAtTimestamp?: number;
    lai: number;
    biomass: number;
    growthRate: number;
    activeTrusses?: number;
    nodeCount?: number;
    sourceCapacity?: number;
    sinkDemand?: number;
    sourceSinkBalance?: number;
    photosynthesis?: number;
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
