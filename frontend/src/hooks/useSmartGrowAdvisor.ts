import { useState } from 'react';
import { API_URL } from '../config';
import { ADVISOR_TAB_ENDPOINTS } from '../components/advisor/advisorTabRegistry';

type AdvisorStatus = 'idle' | 'loading' | 'success' | 'error';
export type AdvisorActionTimelineItem = {
    title: string;
    rationale: string;
    operator?: string | null;
    expected_effect?: string | null;
    badges?: string[];
};
export type AdvisorActionEnvelope = {
    mode: string;
    now: AdvisorActionTimelineItem[];
    today: AdvisorActionTimelineItem[];
    next_3d: AdvisorActionTimelineItem[];
};
export type AdvisorDisplaySection = {
    key: string;
    title: string;
    body: string;
};
export type AdvisorDisplayPayload = {
    summary: string | null;
    risks: string[];
    actions_now: string[];
    actions_today: string[];
    actions_week: string[];
    monitor: string[];
    confidence: number | null;
    sections: AdvisorDisplaySection[];
};
export type ModelRuntimeConstraintViolation = {
    code: string;
    severity: string;
    message: string;
    control?: string | null;
};
export type ModelRuntimeScenarioOutput = {
    horizon_hours: number;
    yield_pred?: number | null;
    fruit_dm_pred?: number | null;
    lai_pred?: number | null;
    transpiration_pred?: number | null;
    canopy_A_pred?: number | null;
    respiration_pred?: number | null;
    energy_cost_pred?: number | null;
    rtr_pred?: number | null;
    source_sink_balance_score?: number | null;
    yield_delta_vs_baseline?: number | null;
    energy_delta_vs_baseline?: number | null;
    source_sink_balance_delta?: number | null;
    confidence_score?: number | null;
    constraint_violations?: ModelRuntimeConstraintViolation[];
};
export type ModelRuntimeScenarioOption = {
    action: string;
    time_window: string;
    control: string;
    direction: string;
    delta: number;
    unit: string;
    score: number;
    expected_yield_delta_24h?: number | null;
    expected_yield_delta_72h?: number | null;
    expected_yield_delta_7d?: number | null;
    expected_yield_delta_14d?: number | null;
    expected_energy_delta?: number | null;
    expected_RTR_delta?: number | null;
    expected_source_sink_balance_delta?: number | null;
    confidence?: number | null;
    violated_constraints: ModelRuntimeConstraintViolation[];
    scenario?: {
        baseline_outputs: ModelRuntimeScenarioOutput[];
        outputs: ModelRuntimeScenarioOutput[];
        violated_constraints: ModelRuntimeConstraintViolation[];
        penalties?: Record<string, number | string | null | boolean>;
    };
};
export type ModelRuntimePayload = {
    status: string;
    summary: string;
    state_snapshot: {
        crop?: string;
        lai?: number | null;
        fruit_load?: number | null;
        source_capacity?: number | null;
        sink_demand?: number | null;
        source_sink_balance?: number | null;
        limiting_factor?: string | null;
        canopy_temperature_c?: number | null;
        canopy_net_assimilation_umol_m2_s?: number | null;
        upper_leaf_activity?: number | null;
        middle_leaf_activity?: number | null;
        bottom_leaf_activity?: number | null;
        observed_signal_score?: number | null;
        dashboard_missing_fields?: string[];
        inferred_fields?: string[];
    };
    scenario: {
        baseline_outputs: ModelRuntimeScenarioOutput[];
        options: ModelRuntimeScenarioOption[];
        recommended: ModelRuntimeScenarioOption | null;
        confidence?: number | null;
        baseline_canopy_A_24h?: number | null;
    };
    sensitivity: {
        target?: string | null;
        analysis_horizon_hours?: number | null;
        confidence: number;
        top_levers: Array<{
            control?: string | null;
            direction?: string | null;
            derivative?: number | null;
            elasticity?: number | null;
            trust_region?: {
                low: number;
                high: number;
            };
            scenario_alignment?: boolean | null;
            bounded_delta?: number | null;
        }>;
    };
    constraint_checks: {
        status: string;
        violated_constraints: ModelRuntimeConstraintViolation[];
        penalties?: Record<string, number | string | null | boolean>;
    };
    recommendations: ModelRuntimeScenarioOption[];
    provenance?: {
        source?: string;
        tab_name?: string;
        selected_controls?: string[];
        derivative_target?: string;
        horizons_hours?: number[];
        dashboard_missing_fields?: string[];
        inferred_fields?: string[];
        observed_signal_score?: number | null;
    };
};
export type PlannedAdvisorTabKey =
    | 'environment'
    | 'physiology'
    | 'work'
    | 'harvest_market';
export type AdvisorTabKey =
    | PlannedAdvisorTabKey
    | 'pesticide'
    | 'nutrient'
    | 'correction';

export type PesticideRecommendationPayload = {
    status: string;
    family: 'pesticide';
    crop: string;
    target_query: string;
    matched_targets: string[];
    product_recommendations: Array<{
        product_name: string;
        product_names?: string[];
        product_aliases?: string[];
        active_ingredient: string;
        matched_targets?: string[];
        moa_code_group: string | null;
        dilution: string | null;
        cycle_recommendation: string | null;
        cycle_solution?: string | null;
        rotation_slot: string | null;
        rotation_slot_index?: number | null;
        rotation_slot_label?: string | null;
        mixing_caution: string | null;
        registration_status: string | null;
        reason_codes?: string[];
        notes_farmer_friendly?: string | null;
        recommendation_reason?: string | null;
        operational_status: string | null;
        application_method?: string | null;
    }>;
    rotation_program: Array<{
        rotation_slot: string | null;
        rotation_slot_index?: number | null;
        rotation_step_index?: number;
        rotation_step_label?: string;
        target_name?: string;
        product_name: string;
        product_names?: string[];
        product_aliases?: string[];
        active_ingredient: string;
        matched_targets?: string[];
        moa_code_group: string | null;
        application_point: string | null;
        reason: string | null;
        notes: string | null;
        reason_codes?: string[];
        reason_summary?: string | null;
        cycle_recommendation: string | null;
        cycle_solution?: string | null;
        mixing_caution: string | null;
        registration_status: string | null;
        operational_status: string | null;
        alternative_reason_code?: string | null;
        alternative_reason?: string | null;
    }>;
    rotation_alternatives?: Array<{
        rotation_slot: string | null;
        rotation_slot_index?: number | null;
        rotation_step_index?: number;
        rotation_step_label?: string;
        target_name?: string;
        product_name: string;
        product_names?: string[];
        product_aliases?: string[];
        active_ingredient: string;
        matched_targets?: string[];
        moa_code_group: string | null;
        application_point: string | null;
        reason: string | null;
        notes: string | null;
        reason_codes?: string[];
        reason_summary?: string | null;
        cycle_recommendation: string | null;
        cycle_solution?: string | null;
        mixing_caution: string | null;
        registration_status: string | null;
        operational_status: string | null;
        alternative_reason_code?: string | null;
        alternative_reason?: string | null;
    }>;
    rotation_guidance?: {
        summary?: string | null;
        recommended_opening_step?: string | null;
        recommended_opening_step_index?: number | null;
        rotation_step_count?: number;
        ready_step_count?: number;
        manual_review_step_count?: number;
        alternative_count?: number;
        policy_code?: string | null;
        policy_label?: string | null;
    };
    limitations: string[];
};

export type NutrientRecommendationPayload = {
    status: string;
    family: 'nutrient';
    crop: string;
    resolved: {
        stage: string;
        medium: string;
        stage_match: string;
        medium_match: string;
    };
    available_stages: string[];
    available_mediums: string[];
    recipe: {
        crop: string;
        medium: string;
        stage: string;
        ec_target: number | null;
        nutrient_targets: Record<string, number | null>;
        guardrails: {
            cl_max: number | null;
            hco3_max: number | null;
            na_max: number | null;
        };
    };
    source_water_baseline: Array<{
        analyte: string;
        mmol_l: number | null;
        mg_l: number | null;
    }>;
    drain_water_baseline: Array<{
        analyte: string;
        mmol_l: number | null;
        mg_l: number | null;
    }>;
    fertilizer_catalog: Array<{
        fertilizer_name: string;
        formula: string | null;
        tank_assignment: string | null;
    }>;
    limitations: string[];
};

export type NutrientCorrectionPayload = {
    status: string;
    family: 'nutrient_correction';
    crop: string;
    resolved: {
        stage: string;
        medium: string;
    };
    correction_context: {
        calculator_defaults: Record<string, number | null>;
        drain_feedback_defaults: Record<string, string | number | null>;
        drain_feedback_policy: {
            mode: string;
            adjustable_analytes: string[];
            step_cap_ratio: number;
            step_cap_min_mmol_l: number;
            step_cap_max_mmol_l: number;
        };
    };
    correction_inputs: {
        submitted_source_water_analytes: string[];
        submitted_drain_water_analytes: string[];
        working_solution_volume_l: {
            effective: number | null;
        };
        stock_ratio: {
            effective: number | null;
        };
    };
    correction_outputs: {
        source_water_review: Array<{
            analyte: string;
            status: string;
            observed_mmol_l: number | null;
            baseline_mmol_l: number | null;
            guardrail_max_mmol_l: number | null;
        }>;
        drain_water_review: Array<{
            analyte: string;
            status: string;
            observed_mmol_l: number | null;
            baseline_mmol_l: number | null;
            guardrail_max_mmol_l: number | null;
        }>;
        drain_feedback_plan: {
            mode: string;
            adjustments: Array<{
                analyte: string;
                canonical_key: string;
                review_status: string | null;
                recipe_target_mmol_l: number | null;
                effective_target_mmol_l: number | null;
                observed_drain_mmol_l: number | null;
                baseline_drain_mmol_l: number | null;
                delta_from_baseline_mmol_l: number | null;
                applied_step_mmol_l: number | null;
                step_cap_mmol_l: number | null;
                status: string;
                target_origin: string;
                clamped: boolean;
                rationale: string;
            }>;
            adjusted_analytes: string[];
            held_analytes: string[];
            manual_review_analytes: string[];
            unreviewed_analytes: string[];
        };
        priority_findings: Array<{
            analyte?: string;
            nutrient?: string;
            analysis_kind: string;
            status: string;
            submitted_mmol_l?: number | null;
            observed_mmol_l?: number | null;
            baseline_mmol_l: number | null;
            guardrail_mmol_l?: number | null;
            guardrail_max_mmol_l?: number | null;
        }>;
        required_manual_inputs: string[];
        stock_tank_prep: {
            balance_basis: {
                draft_mode: string;
                macro_bundle_mode: string;
                draft_eligible_analytes: string[];
                working_solution_volume_l: number | null;
                stock_ratio: number | null;
                stock_solution_volume_l: number | null;
                target_policy: {
                    mode: string;
                    adjusted_analytes: string[];
                    manual_review_analytes: string[];
                    unreviewed_analytes: string[];
                };
                blocked_analytes: string[];
            };
            nutrient_balance: Array<{
                nutrient: string;
                recipe_target_mmol_l?: number | null;
                target_mmol_l: number | null;
                target_origin?: string;
                source_mmol_l: number | null;
                supplemental_need_mmol_l: number | null;
                status: string;
            }>;
            candidate_fertilizers: Record<string, Array<{
                target_analyte: string;
                fertilizer_name: string;
                formula: string | null;
                tank_assignment: string | null;
                guardrail_side_effects: string[];
                operational_status?: string;
                secondary_target_overshoots?: Array<{
                    analyte: string;
                    projected_total_mmol_l: number | null;
                    target_mmol_l: number | null;
                }>;
                single_fertilizer_draft?: {
                    status: string;
                    measurement_coverage?: {
                        submitted_analytes: string[];
                        baseline_analytes: string[];
                        missing_analytes: string[];
                    };
                    provisional_reasons?: string[];
                    estimated_batch_mass?: {
                        fertilizer_grams: number | null;
                    };
                };
            }>>;
            macro_bundle_candidates: Array<{
                rank: number;
                mode: string;
                status: string;
                selected_fertilizers: Array<{
                    lane_analyte: string;
                    fertilizer_name: string;
                    formula: string | null;
                    tank_assignment: string | null;
                    estimated_batch_mass: {
                        fertilizer_grams: number | null;
                    };
                }>;
                residual_to_target_mmol_l: Record<string, number>;
                tank_batch_mass_grams: Record<string, number>;
                measurement_coverage: {
                    submitted_analytes: string[];
                    baseline_analytes: string[];
                    missing_analytes: string[];
                };
                provisional_reasons: string[];
                disclaimer: string;
            }>;
            residual_safe_alternative: {
                status: string;
                policy: string;
                selected_bundle_rank: number | null;
                selected_bundle_over_target_analytes: string[];
                recommended_bundle: null | {
                    rank: number;
                    status: string;
                    lane_order: string[];
                    scorecard: {
                        primary_lane_overshoot_mmol_l: number;
                        objective_gap_abs_mmol_l: number;
                        objective_above_target_mmol_l: number;
                        objective_below_target_mmol_l: number;
                        untargeted_addition_mmol_l: number;
                    };
                    selected_fertilizers: Array<{
                        lane_analyte: string;
                        fertilizer_name: string;
                        formula: string | null;
                        tank_assignment: string | null;
                    }>;
                    measurement_coverage: {
                        submitted_analytes: string[];
                        baseline_analytes: string[];
                        missing_analytes: string[];
                    };
                    provisional_reasons: string[];
                    residual_review: {
                        unresolved_targets: Array<{
                            analyte: string;
                            residual_mmol_l: number;
                            status: string;
                        }>;
                        untargeted_additions: Array<{
                            analyte: string;
                            projected_mmol_l: number;
                        }>;
                        above_target_analytes: string[];
                        below_target_analytes: string[];
                    };
                };
                guidance: string;
            };
            macro_bundle_execution: {
                status: string;
                selected_bundle_rank: number | null;
                stock_solution_volume_l_per_tank: number | null;
                measurement_coverage: {
                    submitted_analytes: string[];
                    baseline_analytes: string[];
                    missing_analytes: string[];
                };
                tank_plan: Array<{
                    tank_assignment: string;
                    total_batch_mass_g: number;
                    stock_solution_concentration_g_l: number | null;
                    fertilizer_lines: Array<{
                        lane_analyte: string;
                        fertilizer_name: string;
                        formula: string | null;
                        batch_mass_g: number;
                    }>;
                }>;
                residual_review: {
                    unresolved_targets: Array<{
                        analyte: string;
                        residual_mmol_l: number;
                        status: string;
                    }>;
                    untargeted_additions: Array<{
                        analyte: string;
                        projected_mmol_l: number;
                    }>;
                    manual_only_analytes: string[];
                    guardrail_breaches: Array<{
                        analyte: string;
                        projected_total_mmol_l: number;
                        guardrail_max_mmol_l: number;
                    }>;
                    blocked_analyte_additions: Array<{
                        analyte: string;
                        projected_delta_mmol_l: number;
                    }>;
                };
                readiness_reasons: string[];
                operator_guidance: string[];
                disclaimer: string;
            };
            unsupported_analytes: Array<{
                nutrient: string;
                reason: string;
            }>;
        };
    };
    limitations: string[];
};

export type PlannedAdvisorTabPayload = {
    status: string;
    family: 'advisor_tab';
    crop: string;
    tab_name: string;
    message: string;
    available_tabs: string[];
    machine_payload: {
        missing_data: string[];
        advisor_actions?: AdvisorActionEnvelope;
        model_runtime?: ModelRuntimePayload | null;
        retrieval_context?: {
            status: string;
            mode?: string;
            query_count?: number;
            returned_count?: number;
            focus_domains?: string[];
            tab_name?: string;
        };
        knowledge_evidence?: {
            status: string;
            mode?: string;
            tab_name?: string;
            focus_domains?: string[];
            focus_topics?: string[];
            evidence_cards?: Array<{
                domain?: string;
                topic_major?: string | null;
                topic_minor?: string | null;
                chunk_type?: string | null;
                evidence_excerpt: string;
            }>;
        } | null;
        environment_analysis?: {
            mode: string;
            summary: string;
            urgency: string;
            confidence: number;
            focus_areas: string[];
            current_state: {
                diagnosis: string;
                operating_mode: string;
                recovery_objective: string;
                target_band: string;
                deviation: string;
                cause_hypotheses: string[];
                risk_flags: string[];
            };
            immediate_actions: Array<{
                title: string;
                rationale: string;
                operator: string;
                expected_effect: string;
                time_window: string;
            }>;
            today_steering: Array<{
                title: string;
                rationale: string;
                operator: string;
                expected_effect: string;
                time_window: string;
            }>;
            three_day_plan: Array<{
                date: string;
                title: string;
                rationale: string;
            }>;
            expected_effects: string[];
            monitoring_checklist: string[];
            context_snapshot: {
                inside_temp_c?: number | null;
                inside_humidity_pct?: number | null;
                inside_vpd_kpa?: number | null;
                inside_co2_ppm?: number | null;
                inside_light_umol_m2_s?: number | null;
                outside_temp_c?: number | null;
                outside_humidity_pct?: number | null;
                outside_cloud_cover_pct?: number | null;
                current_weather_label?: string | null;
                rtr_target_temp_c?: number | null;
                rtr_delta_temp_c?: number | null;
                rtr_balance_state?: string | null;
                temperature_trend?: string | null;
                humidity_trend?: string | null;
                vpd_trend?: string | null;
                next_day_high_temp_c?: number | null;
                next_day_precip_probability_pct?: number | null;
                next_day_radiation_mj_m2?: number | null;
                next_day_sunshine_h?: number | null;
            };
        };
        physiology_analysis?: {
            summary: string;
            urgency: string;
            confidence: number;
            current_state: {
                diagnosis: string;
                balance_state: string;
                deviation: string;
                cause_hypotheses: string[];
                crop_specific_context: string;
            };
            supporting_signals: Array<{
                label: string;
                value: string;
                interpretation: string;
            }>;
            follow_up_actions: Array<{
                title: string;
                rationale: string;
                operator: string;
                expected_effect: string;
                time_window: string;
            }>;
            monitoring_checklist: string[];
            context_snapshot: {
                inside_temp_c?: number | null;
                inside_humidity_pct?: number | null;
                canopy_temp_c?: number | null;
                canopy_air_delta_c?: number | null;
                inside_vpd_kpa?: number | null;
                transpiration_mm_h?: number | null;
                stomatal_conductance_mol_m2_s?: number | null;
                photosynthesis_umol_m2_s?: number | null;
                inside_co2_ppm?: number | null;
                inside_light_umol_m2_s?: number | null;
                lai?: number | null;
                biomass_g_m2?: number | null;
                growth_rate_g_m2_d?: number | null;
                development_stage?: string | null;
                active_trusses?: number | null;
                node_count?: number | null;
                harvestable_fruits?: number | null;
                predicted_weekly_yield_kg?: number | null;
                temperature_trend?: string | null;
                vpd_trend?: string | null;
                transpiration_trend?: string | null;
                photosynthesis_trend?: string | null;
            };
        };
        work_analysis?: {
            mode: string;
            summary: string;
            urgency: string;
            confidence: number;
            focus_areas: string[];
            current_state: {
                diagnosis: string;
                operating_mode: string;
                primary_constraint: string;
                labor_strategy: string;
                workload_balance: string;
                deviation: string;
                cause_hypotheses: string[];
                risk_flags: string[];
            };
            priority_actions: Array<{
                priority: string;
                rank: number;
                category: string;
                title: string;
                message: string;
                action?: string | null;
                time_window: string;
            }>;
            time_windows: Array<{
                window: string;
                focus: string;
                rationale: string;
            }>;
            expected_effects: string[];
            monitoring_checklist: string[];
            context_snapshot: {
                next_day_harvest_kg?: number | null;
                next_day_etc_mm?: number | null;
                daily_energy_kwh?: number | null;
                active_trusses?: number | null;
                node_count?: number | null;
                harvestable_fruits?: number | null;
                humidity_pct?: number | null;
                vpd_kpa?: number | null;
                rtr_delta_temp_c?: number | null;
                forecast_high_temp_c?: number | null;
                missing_work_signals?: string[];
            };
        };
        work_event_compare?: {
            status: string;
            summary: string;
            history: Array<{
                event_time?: string | null;
                event_type?: string | null;
                action: string;
                operator?: string | null;
                reason_code?: string | null;
                confidence?: number | null;
            }>;
            current_state: {
                leaf_count?: number | null;
                lai?: number | null;
                fruit_load?: number | null;
                active_trusses?: number | null;
                source_sink_balance?: number | null;
                minimum_leaf_guard?: number | null;
                bottom_leaf_activity?: number | null;
                sink_overload_score?: number | null;
                active_cohort_id?: number | null;
            };
            options: Array<{
                action: string;
                comparison_kind: string;
                event_type?: string | null;
                operator_note: string;
                risk: string;
                expected_yield_delta_7d?: number | null;
                expected_yield_delta_14d?: number | null;
                expected_canopy_a_delta_72h?: number | null;
                expected_source_sink_balance_delta?: number | null;
                expected_fruit_dm_delta_14d?: number | null;
                expected_lai_delta_14d?: number | null;
                immediate_state_delta?: Record<string, number | null | undefined>;
                replay_effect?: Record<string, unknown> | null;
                confidence?: number | null;
                agronomy_flags?: string[];
                ranking_score?: number | null;
                violated_constraints: Array<{
                    severity?: string;
                    constraint?: string;
                    message?: string;
                }>;
            }>;
            recommended_action?: string | null;
            confidence: number;
        };
        harvest_market_analysis?: {
            summary: string;
            urgency: string;
            confidence: number;
            current_state: {
                harvest_outlook: string;
                market_outlook: string;
                tradeoff_focus: string;
                crop_specific_context: string;
            };
            priority_actions: Array<{
                priority: string;
                title: string;
                rationale: string;
                operator: string;
                expected_effect: string;
                time_window: string;
            }>;
            market_watchlist: Array<{
                display_name: string;
                market_label: string;
                current_price_krw: number | null;
                direction: string | null;
                day_over_day_pct: number | null;
                seasonal_bias: string | null;
                interpretation: string;
            }>;
            timing_windows: Array<{
                window: string;
                focus: string;
                rationale: string;
            }>;
            monitoring_checklist: string[];
            context_snapshot: {
                next_day_harvest_kg?: number | null;
                total_harvest_kg?: number | null;
                predicted_weekly_yield_kg?: number | null;
                harvestable_fruits?: number | null;
                active_trusses?: number | null;
                node_count?: number | null;
                daily_energy_kwh?: number | null;
                humidity_pct?: number | null;
                vpd_kpa?: number | null;
                rtr_delta_temp_c?: number | null;
                rtr_balance_state?: string | null;
                forecast_high_temp_c?: number | null;
                forecast_precip_probability_pct?: number | null;
                next_day_weather_label?: string | null;
                retail_price_krw?: number | null;
                retail_day_over_day_pct?: number | null;
                wholesale_price_krw?: number | null;
                wholesale_day_over_day_pct?: number | null;
                market_reference_day?: string | null;
                seasonal_bias?: string | null;
            };
        };
        advisory_surfaces?: Record<string, unknown>;
        internal_provenance?: {
            catalog_version?: string;
            pending_parsers?: string[];
            surface_routes?: Record<string, string | null | undefined>;
        };
    };
};

type RequestErrorPayload = {
    detail?: string;
    message?: string;
};

type AdvisorExecutionState = {
    status: AdvisorStatus;
    error: string | null;
};

const INITIAL_STATE: Record<AdvisorTabKey, AdvisorExecutionState> = {
    environment: { status: 'idle', error: null },
    physiology: { status: 'idle', error: null },
    work: { status: 'idle', error: null },
    pesticide: { status: 'idle', error: null },
    nutrient: { status: 'idle', error: null },
    correction: { status: 'idle', error: null },
    harvest_market: { status: 'idle', error: null },
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
    const raw = await response.text();
    const json = raw ? (JSON.parse(raw) as T & RequestErrorPayload) : null;

    if (!response.ok) {
        throw new Error(
            json?.detail ?? json?.message ?? raw ?? `HTTP ${response.status}`,
        );
    }

    return json as T;
}

function compactAnalytePayload(values: Record<string, string>): Record<string, number> | undefined {
    const entries = Object.entries(values)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value !== '')
        .map(([key, value]) => [key, Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value));

    if (entries.length === 0) {
        return undefined;
    }

    return Object.fromEntries(entries);
}

export function useSmartGrowAdvisor(crop: string) {
    const [executionState, setExecutionState] =
        useState<Record<AdvisorTabKey, AdvisorExecutionState>>(INITIAL_STATE);
    const [pesticideResult, setPesticideResult] =
        useState<PesticideRecommendationPayload | null>(null);
    const [nutrientResult, setNutrientResult] =
        useState<NutrientRecommendationPayload | null>(null);
    const [correctionResult, setCorrectionResult] =
        useState<NutrientCorrectionPayload | null>(null);
    const [plannedTabResults, setPlannedTabResults] =
        useState<Partial<Record<PlannedAdvisorTabKey, PlannedAdvisorTabPayload>>>({});

    async function execute<T>(
        tab: AdvisorTabKey,
        path: string,
        body: Record<string, unknown>,
    ): Promise<T> {
        setExecutionState((current) => ({
            ...current,
            [tab]: { status: 'loading', error: null },
        }));

        try {
            const response = await fetch(`${API_URL}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ crop, ...body }),
            });
            const payload = await parseJsonResponse<T>(response);
            setExecutionState((current) => ({
                ...current,
                [tab]: { status: 'success', error: null },
            }));
            return payload;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_error';
            setExecutionState((current) => ({
                ...current,
                [tab]: { status: 'error', error: message },
            }));
            throw error;
        }
    }

    async function runPesticide(target: string, limit: number) {
        const payload = await execute<PesticideRecommendationPayload>(
            'pesticide',
            '/advisor/tab/pesticide',
            { target, limit },
        );
        setPesticideResult(payload);
    }

    async function runNutrient(stage?: string, medium?: string) {
        const payload = await execute<NutrientRecommendationPayload>(
            'nutrient',
            '/advisor/tab/nutrient',
            {
                stage: stage || null,
                medium: medium || null,
            },
        );
        setNutrientResult(payload);
    }

    async function runCorrection(args: {
        stage?: string;
        medium?: string;
        sourceWater: Record<string, string>;
        drainWater: Record<string, string>;
        workingSolutionVolumeL?: string;
        stockRatio?: string;
    }) {
        const payload = await execute<NutrientCorrectionPayload>(
            'correction',
            '/advisor/tab/correction',
            {
                stage: args.stage || null,
                medium: args.medium || null,
                source_water_mmol_l: compactAnalytePayload(args.sourceWater),
                drain_water_mmol_l: compactAnalytePayload(args.drainWater),
                working_solution_volume_l:
                    args.workingSolutionVolumeL && args.workingSolutionVolumeL.trim() !== ''
                        ? Number(args.workingSolutionVolumeL)
                        : null,
                stock_ratio:
                    args.stockRatio && args.stockRatio.trim() !== ''
                        ? Number(args.stockRatio)
                        : null,
            },
        );
        setCorrectionResult(payload);
    }

    async function runPlannedTab(
        tab: PlannedAdvisorTabKey,
        dashboard?: Record<string, unknown> | null,
    ) {
        const payload = await execute<PlannedAdvisorTabPayload>(
            tab,
            ADVISOR_TAB_ENDPOINTS[tab],
            dashboard ? { dashboard } : {},
        );
        setPlannedTabResults((current) => ({
            ...current,
            [tab]: payload,
        }));
    }

    return {
        executionState,
        pesticideResult,
        nutrientResult,
        correctionResult,
        plannedTabResults,
        runPesticide,
        runNutrient,
        runCorrection,
        runPlannedTab,
    };
}
