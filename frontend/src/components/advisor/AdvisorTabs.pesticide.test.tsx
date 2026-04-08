import { render, screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import type { PesticideRecommendationPayload } from '../../hooks/useSmartGrowAdvisor';
import AdvisorTabs from './AdvisorTabs';

const mockUseSmartGrowAdvisor = vi.fn();

vi.mock('../../hooks/useSmartGrowAdvisor', async () => {
    const actual = await vi.importActual<typeof import('../../hooks/useSmartGrowAdvisor')>(
        '../../hooks/useSmartGrowAdvisor',
    );
    return {
        ...actual,
        useSmartGrowAdvisor: () => mockUseSmartGrowAdvisor(),
    };
});

vi.mock('../../utils/aiDashboardContext', () => ({
    buildAiDashboardContext: () => ({}),
}));

function buildPesticidePayload(): PesticideRecommendationPayload {
    return {
        status: 'success',
        family: 'pesticide',
        crop: 'tomato',
        target_query: '흰가루병',
        matched_targets: ['흰가루병'],
        product_recommendations: [
            {
                product_name: 'AzoxyGuard',
                product_names: ['AzoxyGuard', '아족시가드'],
                product_aliases: ['아족시가드'],
                active_ingredient: 'Azoxystrobin',
                matched_targets: ['흰가루병'],
                moa_code_group: 'FRAC 11',
                dilution: '1000배',
                cycle_recommendation: '7일 간격',
                cycle_solution: '7일 간격',
                rotation_slot: 'slot-1',
                rotation_slot_index: 1,
                rotation_slot_label: '1차',
                mixing_caution: '알칼리제 혼용 주의',
                registration_status: 'existing-registration',
                reason_codes: ['target-match', 'rotation-slot', 'cycle-available', 'registration-ready'],
                notes_farmer_friendly: '백엔드 한글 reason',
                recommendation_reason: '백엔드 한글 reason',
                operational_status: 'ready',
                application_method: null,
            },
        ],
        rotation_program: [
            {
                rotation_slot: '1차',
                rotation_slot_index: 1,
                rotation_step_index: 1,
                rotation_step_label: '1단계',
                target_name: '흰가루병',
                product_name: 'AzoxyGuard',
                product_names: ['AzoxyGuard', '아족시가드'],
                product_aliases: ['아족시가드'],
                active_ingredient: 'Azoxystrobin',
                matched_targets: ['흰가루병'],
                moa_code_group: 'FRAC 11',
                application_point: '초발생 전 예방 살포',
                reason: '교차저항성 분산',
                notes: '초기 압력 억제',
                reason_codes: ['application-point', 'rotation-rationale', 'field-note'],
                reason_summary: '백엔드 한글 요약',
                cycle_recommendation: '7일 간격',
                cycle_solution: '7일 간격',
                mixing_caution: '알칼리제 혼용 주의',
                registration_status: 'existing-registration',
                operational_status: 'ready',
                alternative_reason: null,
            },
        ],
        rotation_alternatives: [
            {
                rotation_slot: '2차',
                rotation_slot_index: 2,
                rotation_step_index: 1,
                rotation_step_label: '1단계',
                target_name: '흰가루병',
                product_name: 'LabelCheckOne',
                product_names: ['LabelCheckOne'],
                product_aliases: [],
                active_ingredient: 'Boscalid',
                matched_targets: ['흰가루병'],
                moa_code_group: 'FRAC 7',
                application_point: '압력 상승 구간',
                reason: '등록 범위 재확인 필요',
                notes: '',
                reason_codes: ['application-point', 'rotation-rationale', 'manual-review'],
                reason_summary: '백엔드 한글 요약',
                cycle_recommendation: '5~7일 간격',
                cycle_solution: '5~7일 간격',
                mixing_caution: '구리제 혼용 주의',
                registration_status: 'label-check-required',
                operational_status: 'manual-review-required',
                alternative_reason_code: 'manual-review',
                alternative_reason: '백엔드 한글 대안 사유',
            },
        ],
        rotation_guidance: {
            summary: '백엔드 한글 요약',
            recommended_opening_step: '1단계',
            recommended_opening_step_index: 1,
            rotation_step_count: 1,
            ready_step_count: 1,
            manual_review_step_count: 0,
            alternative_count: 1,
            policy_code: 'registered-first-unique-moa',
            policy_label: '백엔드 한글 정책',
        },
        limitations: [
            'Narrative or placeholder rotation rows were withheld from the returned program instead of being surfaced as executable recommendations.',
            'The candidate pool still contains unknown or label-check-required rows; those stay marked for manual label review before operational rollout.',
        ],
    };
}

function buildLegacyPesticidePayload(): PesticideRecommendationPayload {
    return {
        status: 'success',
        family: 'pesticide',
        crop: 'tomato',
        target_query: '흰가루병',
        matched_targets: ['흰가루병'],
        product_recommendations: [
            {
                product_name: 'LegacyGuard',
                active_ingredient: 'Legacy ingredient',
                matched_targets: ['흰가루병'],
                moa_code_group: 'FRAC M',
                dilution: '800배',
                cycle_recommendation: '5일 간격',
                rotation_slot: 'slot-1',
                mixing_caution: '혼용주의 확인',
                registration_status: 'existing-registration',
                operational_status: 'ready',
            },
        ],
        rotation_program: [
            {
                rotation_slot: '1차',
                product_name: 'LegacyGuard',
                active_ingredient: 'Legacy ingredient',
                moa_code_group: 'FRAC M',
                application_point: '발생 초기에 바로 살포',
                reason: '기존 약제와 계통 교호',
                notes: null,
                cycle_recommendation: '5일 간격',
                mixing_caution: '혼용주의 확인',
                registration_status: 'existing-registration',
                operational_status: 'ready',
            },
        ],
        limitations: ['라벨 확인 필요'],
    };
}

function renderAdvisorTabs() {
    render(
        <LocaleProvider>
            <AdvisorTabs
                crop="Tomato"
                summary={null}
                currentData={{} as never}
                metrics={{} as never}
                history={[]}
                forecast={null}
                producePrices={null}
                weather={null}
                rtrProfile={null}
                isOpen
                initialTab="pesticide"
                onClose={() => undefined}
            />
        </LocaleProvider>,
    );
}

describe('AdvisorTabs pesticide surface', () => {
    beforeEach(() => {
        mockUseSmartGrowAdvisor.mockReset();
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ko');
    });

    it('renders product aliases, cycle guidance, and backup rotation options in Korean', () => {
        mockUseSmartGrowAdvisor.mockReturnValue({
            executionState: {
                environment: { status: 'idle', error: null },
                physiology: { status: 'idle', error: null },
                work: { status: 'idle', error: null },
                pesticide: { status: 'success', error: null },
                nutrient: { status: 'idle', error: null },
                correction: { status: 'idle', error: null },
                harvest_market: { status: 'idle', error: null },
            },
            pesticideResult: buildPesticidePayload(),
            nutrientResult: null,
            correctionResult: null,
            plannedTabResults: {},
            runPesticide: vi.fn(),
            runNutrient: vi.fn(),
            runCorrection: vi.fn(),
            runPlannedTab: vi.fn(),
        });

        renderAdvisorTabs();

        expect(screen.getAllByText('아족시가드').length).toBeGreaterThan(0);
        expect(
            screen.getAllByText((_, element) => (
                Boolean(
                    element?.textContent?.includes('제품명:')
                    && element.textContent.includes('아족시가드')
                    && element.textContent.includes('AzoxyGuard'),
                )
            )).length,
        ).toBeGreaterThan(0);
        expect(screen.getAllByText(/권장 주기: 7일 간격/).length).toBeGreaterThan(0);
        expect(screen.getByText('추천 교호안')).toBeTruthy();
        expect(screen.getAllByText(/초발생 전 예방 살포/).length).toBeGreaterThan(0);
        expect(screen.getByText('예비 교호 대안')).toBeTruthy();
        expect(screen.getByText(/등록 또는 라벨 확인이 더 필요해 예비안으로만 남겼습니다./)).toBeTruthy();
        expect(screen.getByText(/설명용이거나 정보가 불완전한 교호 행은 실행안에서 제외했습니다./)).toBeTruthy();
    });

    it('keeps rendering legacy payloads without additive rotation fields', () => {
        mockUseSmartGrowAdvisor.mockReturnValue({
            executionState: {
                environment: { status: 'idle', error: null },
                physiology: { status: 'idle', error: null },
                work: { status: 'idle', error: null },
                pesticide: { status: 'success', error: null },
                nutrient: { status: 'idle', error: null },
                correction: { status: 'idle', error: null },
                harvest_market: { status: 'idle', error: null },
            },
            pesticideResult: buildLegacyPesticidePayload(),
            nutrientResult: null,
            correctionResult: null,
            plannedTabResults: {},
            runPesticide: vi.fn(),
            runNutrient: vi.fn(),
            runCorrection: vi.fn(),
            runPlannedTab: vi.fn(),
        });

        renderAdvisorTabs();

        expect(screen.getAllByText((_, element) => Boolean(element?.textContent?.includes('LegacyGuard'))).length).toBeGreaterThan(0);
        expect(screen.getByText(/추천 교호안/)).toBeTruthy();
        expect(screen.getAllByText(/1단계 교호안을 정리했습니다\./).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/등록 우선 · 계통 중복 최소화/).length).toBeGreaterThan(0);
        expect(screen.queryByText('예비 교호 대안')).toBeNull();
        expect(screen.getAllByText(/발생 초기에 바로 살포/).length).toBeGreaterThan(0);
    });

    it('renders localized English guidance instead of backend Korean narrative strings', () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
        mockUseSmartGrowAdvisor.mockReturnValue({
            executionState: {
                environment: { status: 'idle', error: null },
                physiology: { status: 'idle', error: null },
                work: { status: 'idle', error: null },
                pesticide: { status: 'success', error: null },
                nutrient: { status: 'idle', error: null },
                correction: { status: 'idle', error: null },
                harvest_market: { status: 'idle', error: null },
            },
            pesticideResult: buildPesticidePayload(),
            nutrientResult: null,
            correctionResult: null,
            plannedTabResults: {},
            runPesticide: vi.fn(),
            runNutrient: vi.fn(),
            runCorrection: vi.fn(),
            runPlannedTab: vi.fn(),
        });

        renderAdvisorTabs();

        expect(screen.getByText('Recommended rotation')).toBeTruthy();
        expect(screen.getAllByText(/Registered first · minimize MOA duplication/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Cycle 1 candidate/).length).toBeGreaterThan(0);
        expect(
            screen.getAllByText((_, element) => (
                Boolean(
                    element?.textContent?.includes('Recommended cycle')
                    && element.textContent.includes('7일 간격'),
                )
            )).length,
        ).toBeGreaterThan(0);
        expect(screen.getByText(/Narrative or incomplete rotation rows were kept out of the executable rotation./)).toBeTruthy();
        expect(screen.queryByText('백엔드 한글 요약')).toBeNull();
        expect(screen.queryByText('백엔드 한글 정책')).toBeNull();
        expect(screen.queryByText('백엔드 한글 reason')).toBeNull();
        expect(screen.queryByText('백엔드 한글 대안 사유')).toBeNull();
    });

    it('derives English rotation guidance even when legacy payload omits additive fields', () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
        mockUseSmartGrowAdvisor.mockReturnValue({
            executionState: {
                environment: { status: 'idle', error: null },
                physiology: { status: 'idle', error: null },
                work: { status: 'idle', error: null },
                pesticide: { status: 'success', error: null },
                nutrient: { status: 'idle', error: null },
                correction: { status: 'idle', error: null },
                harvest_market: { status: 'idle', error: null },
            },
            pesticideResult: buildLegacyPesticidePayload(),
            nutrientResult: null,
            correctionResult: null,
            plannedTabResults: {},
            runPesticide: vi.fn(),
            runNutrient: vi.fn(),
            runCorrection: vi.fn(),
            runPlannedTab: vi.fn(),
        });

        renderAdvisorTabs();

        expect(screen.getByText('Recommended rotation')).toBeTruthy();
        expect(screen.getAllByText(/Built a 1-step rotation\./).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Registered first · minimize MOA duplication/).length).toBeGreaterThan(0);
        expect(screen.queryByText('Backup options')).toBeNull();
        expect(screen.queryByText('백엔드 한글 요약')).toBeNull();
        expect(screen.queryByText('백엔드 한글 정책')).toBeNull();
    });
});
