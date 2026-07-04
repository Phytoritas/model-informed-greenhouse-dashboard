import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import type { ModelRuntimePayload } from '../../hooks/useSmartGrowAdvisor';
import AdvisorModelRuntimePanel from './AdvisorModelRuntimePanel';

function createRuntime(
    overrides: Partial<ModelRuntimePayload> = {},
): ModelRuntimePayload {
    return {
        status: 'ready',
        summary: 'Scenario ready.',
        state_snapshot: {
            lai: 3.2,
            source_sink_balance: 0.12,
            canopy_net_assimilation_umol_m2_s: 14.5,
            observed_signal_score: 0.82,
        },
        scenario: {
            baseline_outputs: [],
            options: [{
                action: 'Lower humidity target.',
                time_window: 'now',
                control: 'rh_target',
                direction: 'decrease',
                delta: -3,
                unit: '%p',
                score: 0.74,
                violated_constraints: [],
            }],
            recommended: null,
        },
        sensitivity: {
            confidence: 0.8,
            top_levers: [{
                control: 'rh_target',
                direction: 'decrease',
                elasticity: -0.21,
                trust_region: {
                    low: -5,
                    high: 5,
                },
                scenario_alignment: true,
            }],
        },
        constraint_checks: {
            status: 'pass',
            violated_constraints: [],
        },
        recommendations: [],
        ...overrides,
    };
}

function renderPanel(runtime: ModelRuntimePayload, locale: 'ko' | 'en' = 'en') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    render(
        <LocaleProvider>
            <AdvisorModelRuntimePanel runtime={runtime} />
        </LocaleProvider>,
    );
}

describe('AdvisorModelRuntimePanel friendly copy', () => {
    it('keeps the no-violation scenario badge readable', () => {
        renderPanel(createRuntime(), 'en');

        expect(screen.getByText('No violations')).toBeTruthy();
        expect(screen.queryByText('Operating constraint needs review')).toBeNull();
    });

    it('renders mapped constraint copy without backend identifiers', () => {
        renderPanel(createRuntime({
            constraint_checks: {
                status: 'fail',
                violated_constraints: [{
                    code: 'humidity_floor_risk',
                    control: 'rh_target',
                    severity: 'medium',
                    message: 'Resulting RH falls below the bounded recovery floor.',
                }],
            },
        }), 'ko');

        expect(screen.getByText('습도 회복 하한 위험')).toBeTruthy();
        expect(screen.queryByText(/humidity_floor_risk/)).toBeNull();
        expect(screen.queryByText(/rh_target/)).toBeNull();
        expect(screen.queryByText(/bounded recovery floor/)).toBeNull();
    });
});
