import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import AdvisorQualityProfilePanel from './AdvisorQualityProfilePanel';
import type { AdaptiveQualityProfile } from '../../hooks/useAdaptiveAdvisor';

const profile: AdaptiveQualityProfile = {
  schema_version: 'advisor-quality-profile.v1',
  capability: 'CONSTRAINED_OPTIMIZATION',
  answer_status: 'CONDITIONAL',
  score: 0.78,
  data: {
    freshness: 0.95,
    current_state_coverage: 0.8,
    history_coverage: 1,
    missing_fields: ['operations.shift_capacity'],
    inferred_fields: [],
    latest_observation_at: '2026-08-15T07:00:00Z',
  },
  model: {
    applicability: 0.84,
    exact_request_match: true,
    within_supported_range: true,
    scenario_confidence: 0.82,
    constraint_status: 'WARNING',
    violated_constraints: [],
  },
  context: {
    expert_knowledge: 'READY',
    weather: 'READY',
    operations: 'PARTIAL',
    market: 'READY',
  },
  horizon: {
    valid_from: '2026-08-15T07:00:00Z',
    valid_until: '2026-08-15T07:30:00Z',
    forecast_hours: 336,
    invalidation_events: ['market_refresh'],
  },
  adaptive_triggers: ['market_refresh'],
  executed_nodes: ['freeze_snapshot', 'quality_gate'],
};

test('renders capability, status, and missing-data dimensions', () => {
  render(<AdvisorQualityProfilePanel profile={profile} locale="ko" />);
  expect(screen.getByText('제약조건 최적화')).toBeTruthy();
  expect(screen.getByText('조건부 답변')).toBeTruthy();
  expect(screen.getByText('78%')).toBeTruthy();
  expect(screen.getByText(/operations.shift_capacity/)).toBeTruthy();
});
