import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import AdvisorQualityProfilePanel from './AdvisorQualityProfilePanel';
import type { AdaptiveQualityProfile } from '../../hooks/useAdaptiveAdvisor';

const profile: AdaptiveQualityProfile = {
  schema_version: 'advisor-quality-profile.v2',
  capability: 'CONSTRAINED_OPTIMIZATION',
  answer_status: 'CONDITIONAL',
  score: 0.74,
  readiness_score: 0.88,
  data: {
    freshness: 0.95,
    current_state_coverage: 0.8,
    history_coverage: 1,
    missing_fields: ['operations.shift_capacity'],
    inferred_fields: ['fruit_load'],
    observed_signal_score: 0.75,
    latest_observation_at: '2026-08-15T07:00:00Z',
  },
  model: {
    applicability: 0.67,
    exact_request_match: true,
    within_supported_range: true,
    scenario_confidence: 0.82,
    observed_input_fraction: 0.72,
    inferred_input_count: 1,
    constraint_status: 'WARNING',
    violated_constraints: [],
  },
  context: {
    expert_knowledge: 'READY',
    weather: 'READY',
    operations: 'PARTIAL',
    market: 'PARTIAL',
  },
  content: {
    diagnostic_depth: 0.78,
    actionability: 0.86,
    temporal_alignment: 1,
    cross_domain_synthesis: 0.7,
    numerical_integrity: 1,
    uncertainty_honesty: 0.92,
    gaps: ['unregistered_operator_assumption'],
  },
  response: {
    coverage: 1,
    required_elements: ['explanation', 'action', 'uncertainty'],
    present_elements: ['explanation', 'action', 'uncertainty'],
    unsupported_numeric_claims: [],
    fallback_used: true,
    source: 'deterministic_fallback',
    reasons: ['response_element_missing'],
  },
  horizon: {
    valid_from: '2026-08-15T07:00:00Z',
    valid_until: '2026-08-15T07:30:00Z',
    forecast_hours: 336,
    invalidation_events: ['market_refresh'],
  },
  adaptive_triggers: ['market_refresh'],
  executed_nodes: ['freeze_snapshot', 'response_review', 'quality_gate'],
};

test('renders delivered quality separately from readiness and exposes response limits', () => {
  render(<AdvisorQualityProfilePanel profile={profile} locale="ko" />);
  expect(screen.getByText('제약조건 최적화')).toBeTruthy();
  expect(screen.getByText('조건부 답변')).toBeTruthy();
  expect(screen.getAllByText('74%').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('88%')).toBeTruthy();
  expect(screen.getByText('LLM 답변 자동 교체')).toBeTruthy();
  expect(screen.getByText('검증된 결정론적 대체 답변')).toBeTruthy();
  expect(screen.getByText(/질문에 포함된 운영 가정/)).toBeTruthy();
  expect(screen.getByText(/operations.shift_capacity/)).toBeTruthy();
});
