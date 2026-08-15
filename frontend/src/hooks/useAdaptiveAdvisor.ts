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
  | 'quality_gate'
  | 'narrate';

export type AdaptiveQualityProfile = {
  schema_version: 'advisor-quality-profile.v1';
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
  data: {
    freshness: number;
    current_state_coverage: number;
    history_coverage: number;
    missing_fields: string[];
    inferred_fields: string[];
    latest_observation_at?: string | null;
  };
  model: {
    applicability: number;
    exact_request_match?: boolean | null;
    within_supported_range?: boolean | null;
    scenario_confidence?: number | null;
    constraint_status: 'PASS' | 'WARNING' | 'FAIL';
    violated_constraints: Array<Record<string, unknown>>;
  };
  context: {
    expert_knowledge: string;
    weather: string;
    operations: string;
    market: string;
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
  schema_version: 'adaptive-advisor-response.v1';
  status: 'success' | 'degraded' | 'refused';
  crop: 'tomato' | 'cucumber';
  greenhouse_id: string;
  question: string;
  snapshot_fingerprint: string;
  plan: {
    schema_version: 'adaptive-advisor-plan.v1';
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
  text: string;
};

export type AdaptiveAdvisorInput = {
  crop: 'tomato' | 'cucumber';
  greenhouse_id?: string;
  question: string;
  dashboard: Record<string, unknown>;
  language: 'ko' | 'en';
  include_narrative?: boolean;
};

type AdaptiveAdvisorState = {
  loading: boolean;
  result: AdaptiveAdvisorResult | null;
  error: string | null;
};

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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.detail === 'string'
            ? payload.detail
            : `Adaptive advisor failed (${response.status})`,
        );
      }
      setState({
        loading: false,
        result: payload as AdaptiveAdvisorResult,
        error: null,
      });
      return payload as AdaptiveAdvisorResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Adaptive advisor failed';
      setState({ loading: false, result: null, error: message });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, result: null, error: null });
  }, []);

  return { ...state, execute, reset };
}
