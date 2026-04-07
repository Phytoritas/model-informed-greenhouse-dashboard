import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PlannedAdvisorTabPayload } from '../../hooks/useSmartGrowAdvisor';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import WorkTab from './WorkTab';

function buildWorkPayload(): PlannedAdvisorTabPayload {
    return {
        status: 'success',
        family: 'advisor_tab',
        crop: 'tomato',
        tab_name: 'work',
        message: 'ok',
        available_tabs: ['environment', 'physiology', 'work', 'harvest_market'],
        machine_payload: {
            missing_data: [],
            work_analysis: {
                mode: 'deterministic',
                summary: 'Work summary for the current crop state.',
                urgency: 'medium',
                confidence: 0.82,
                focus_areas: ['labor_balance'],
                current_state: {
                    diagnosis: 'Stable work pressure',
                    operating_mode: 'active',
                    primary_constraint: 'fruit load',
                    labor_strategy: 'staggered',
                    workload_balance: 'balanced',
                    deviation: 'minor',
                    cause_hypotheses: ['fruit load remains elevated'],
                    risk_flags: ['watch-load'],
                },
                priority_actions: [],
                time_windows: [],
                expected_effects: ['Keep fruit load and labor balanced.'],
                monitoring_checklist: ['Watch the next work window.'],
                context_snapshot: {
                    next_day_harvest_kg: 12.4,
                    next_day_etc_mm: 3.1,
                    daily_energy_kwh: 145.2,
                    active_trusses: 8,
                    node_count: 31,
                    harvestable_fruits: 26,
                    humidity_pct: 82,
                    vpd_kpa: 0.74,
                    rtr_delta_temp_c: -0.6,
                    forecast_high_temp_c: 25.1,
                },
            },
            work_event_compare: {
                status: 'ready',
                summary: 'Compared persisted work-event scenarios.',
                history: [
                    {
                        action: 'Previous thinning',
                        event_type: 'fruit_thinning',
                        event_time: '2026-04-07T08:00:00Z',
                    },
                ],
                current_state: {
                    leaf_count: 18,
                    lai: 1.46,
                    fruit_load: 20,
                    active_trusses: 8,
                    source_sink_balance: -0.12,
                    minimum_leaf_guard: 15,
                    sink_overload_score: 0.62,
                },
                options: [
                    {
                        action: 'Thin 1 fruit',
                        comparison_kind: 'candidate_event',
                        operator_note: 'Relieves sink overload without over-correcting.',
                        risk: 'medium',
                        expected_yield_delta_7d: 0.4,
                        expected_yield_delta_14d: 1.1,
                        expected_canopy_a_delta_72h: 0.08,
                        expected_source_sink_balance_delta: 0.11,
                        expected_fruit_dm_delta_14d: 0.9,
                        expected_lai_delta_14d: -0.03,
                        confidence: 0.79,
                        agronomy_flags: ['sink_overload', 'fruit_pressure'],
                        immediate_state_delta: {
                            fruit_load_delta: -1,
                        },
                        violated_constraints: [],
                    },
                ],
                recommended_action: 'Thin 1 fruit',
                confidence: 0.79,
            },
        },
    };
}

function renderWorkTab(result: PlannedAdvisorTabPayload) {
    return render(
        <LocaleProvider>
            <WorkTab
                status="success"
                error={null}
                result={result}
                onRun={() => undefined}
            />
        </LocaleProvider>,
    );
}

describe('WorkTab', () => {
    beforeEach(() => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    });

    it('renders work-event compare agronomy details for the active option', () => {
        renderWorkTab(buildWorkPayload());

        screen.getByText('Work-event compare');
        screen.getByText('Compared persisted work-event scenarios.');
        screen.getByText('Recommended action:Thin 1 fruit');
        screen.getByText(/Confidence:79%/i);
        screen.getByText('Sink overload');
        screen.getByText('Fruit pressure');
        screen.getByText('Thin 1 fruit');
    });

    it('renders the unavailable compare fallback without option cards', () => {
        const result = buildWorkPayload();
        if (!result.machine_payload.work_event_compare) {
            throw new Error('work_event_compare must exist in the test fixture');
        }
        result.machine_payload.work_event_compare.status = 'history-unavailable';
        result.machine_payload.work_event_compare.summary = 'No persisted model snapshot is available.';
        result.machine_payload.work_event_compare.options = [];

        renderWorkTab(result);

        expect(screen.getAllByText('No persisted model snapshot is available.')).toHaveLength(2);
        expect(screen.queryByText(/Agronomy/i)).toBeNull();
        expect(screen.queryByText('Thin 1 fruit')).toBeNull();
    });
});
