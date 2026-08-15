import { useCallback, useState } from 'react';
import { API_URL } from '../config';

export type AdaptiveNodeName =
  | 'freeze_snapshot'
  | 'live_snapshot'
  | 'history_compare'
  | 'environment_analysis'
  | 'physiology_diagnosis'
  | 'work_planning'
  | 'harvest_market_analysis'
  | 'bounded_scenario'
  | 'sensitivity'
  | 'expert_wiki'
  | 'weather_outlook'
  | 'market_outlook'
  | 'operations_calendar'
  | 'constraint_gate'
  | 'answer_admission'
  | 'answer_packet'
  | 'narrate'
  | 'response_review'
  | 'quality_gate';

export type AdaptiveQualityProfile = {
  schema_version: 'advisor-quality-profile.v2';
  capability:
    | 'LIVE_STATUS'
    | 'DIAGNOSTIC'
    | 'MODEL_WHAT_IF'
    | 'OPERATIONAL_PLAN'
    | 'CONSTRAINED_OPTIMIZATION';
  answer_status:
    | 'OPERATIONAL'
    | 'CONDITIONAL'
    | 'MONITORING_FIRST'
    | 'NEEDS_DATA'
    | 'REFUSED';
  score: number;
  readiness_score: number;
  data: {
    freshness: number;
    current_state_coverage: number;
    history_coverage: number;
    missing_fields: string[];
    inferred_fields: string[];
    observed_signal_score?: number | null;
    latest_observation_at?: string | null;
  };
  model: {
    applicability: number;
    exact_request_match?: boolean | null;
    within_supported_range?: boolean | null;
    scenario_confidence?: number | null;
    observed_input_fraction?: number | null;
    inferred_input_count: number;
    constraint_status: 'PASS' | 'WARNING' | 'FAIL';
    violated_constraints: Array<Record<string, unknown>>;
  };
  context: {
    expert_knowledge: string;
    weather: string;
    operations: string;
    market: string;
  };
  content: {
    diagnostic_depth: number;
    actionability: number;
    temporal_alignment: number;
    cross_domain_synthesis: number;
    numerical_integrity: number;
    uncertainty_honesty: number;
    gaps: string[];
  };
  response: {
    coverage: number;
    required_elements: string[];
    present_elements: string[];
    unsupported_numeric_claims: string[];
    fallback_used: boolean;
    source: 'llm' | 'deterministic_fallback' | 'deterministic_only';
    reasons: string[];
  };
  horizon: {
    valid_from: string;
    valid_until: string;
    forecast_hours: number;
    invalidation_events: string[];
  };
  adaptive_triggers: string[];
  executed_nodes: AdaptiveNodeName[];
};

export type AdaptiveAdvisorResult = {
  schema_version: 'adaptive-advisor-response.v2';
  run_id: string;
  status: 'success' | 'degraded' | 'refused';
  crop: 'tomato' | 'cucumber';
  greenhouse_id: string;
  question: string;
  snapshot_fingerprint: string;
  plan: {
    schema_version: 'adaptive-advisor-plan.v2';
    intent: 'STATUS' | 'DIAGNOSE' | 'WHAT_IF' | 'PLAN' | 'OPTIMIZE';
    nodes: AdaptiveNodeName[];
    controls: string[];
    horizons_hours: number[];
    reasons: string[];
  };
  trace: Array<{
    node: AdaptiveNodeName;
    status: 'SUCCESS' | 'SKIPPED' | 'DEGRADED' | 'FAILED';
    duration_ms: number;
    summary: string;
    error?: string | null;
  }>;
  quality_profile: AdaptiveQualityProfile;
  constraint_gate: {
    status: 'PASS' | 'WARNING' | 'FAIL';
    risk_flags: string[];
    violations: Array<Record<string, unknown>>;
    reason?: string | null;
  };
  admission: {
    admitted: boolean;
    exact_request_match?: boolean | null;
    within_supported_range?: boolean | null;
    reasons: string[];
  };
  answer_packet: {
    causal_drivers: Array<{
      code: string;
      label: string;
      support: number;
      observations: string[];
    }>;
    actions: Array<{
      rank: number;
      title: string;
      operator: string;
      time_window: string;
      expected_effect: string;
      condition?: string | null;
    }>;
    uncertainties: string[];
    market_context: Record<string, unknown>;
  };
  text: string;
  machine_payload?: {
    history_authority?: string;
    market_model?: string;
  };
};

export type AdaptiveAdvisorInput = {
  crop: 'tomato' | 'cucumber';
  greenhouse_id?: string;
  question: string;
  dashboard: Record<string, unknown>;
  language: 'ko' | 'en';
  include_narrative?: boolean;
};

export type AdaptiveFeedbackIssue =
  | 'missing_cause'
  | 'vague_action'
  | 'wrong_number'
  | 'missing_context'
  | 'too_verbose'
  | 'wrong_route'
  | 'other';

type AdaptiveAdvisorState = {
  loading: boolean;
  result: AdaptiveAdvisorResult | null;
  error: string | null;
};

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload?.detail === 'string'
        ? payload.detail
        : `Adaptive advisor failed (${response.status})`,
    );
  }
  return payload;
}

export function useAdaptiveAdvisor() {
  const [state, setState] = useState<AdaptiveAdvisorState>({
    loading: false,
    result: null,
    error: null,
  });

  const execute = useCallback(async (input: AdaptiveAdvisorInput) => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response = await fetch(`${API_URL}/advisor/adaptive/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          messages: [],
          include_narrative: input.include_narrative ?? true,
        }),
      });
      const payload = await parseResponse(response) as AdaptiveAdvisorResult;
      setState({ loading: false, result: payload, error: null });
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Adaptive advisor failed';
      setState({ loading: false, result: null, error: message });
      throw error;
    }
  }, []);

  const submitFeedback = useCallback(async (input: {
    run_id: string;
    helpful: boolean;
    issue_codes?: AdaptiveFeedbackIssue[];
    comment?: string;
  }) => {
    const response = await fetch(`${API_URL}/advisor/adaptive/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_id: input.run_id,
        helpful: input.helpful,
        issue_codes: input.issue_codes ?? [],
        comment: input.comment ?? null,
      }),
    });
    return parseResponse(response);
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, result: null, error: null });
  }, []);

  return { ...state, execute, submitFeedback, reset };
}
