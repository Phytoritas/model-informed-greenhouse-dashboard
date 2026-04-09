import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import RagAssistantDrawer from './RagAssistantDrawer';

const fetchMock = vi.fn();

function renderDrawer(request?: {
    preset?: 'general' | 'environment' | 'physiology' | 'pesticide' | 'nutrient';
    query?: string;
    autoRun?: boolean;
    source?: 'advisor' | 'assistant' | 'dashboard';
}) {
    return render(
        <LocaleProvider>
            <RagAssistantDrawer
                isOpen
                onClose={() => undefined}
                crop="Tomato"
                request={
                    request
                        ? {
                            nonce: 1,
                            ...request,
                        }
                        : null
                }
            />
        </LocaleProvider>,
    );
}

describe('RagAssistantDrawer', () => {
    beforeEach(() => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ko');
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders routed knowledge scope details for an auto-run seeded request', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                query_status: 'ready',
                query_mode: 'intent_routed_hybrid',
                returned_count: 1,
                resolved_scope: 'tomato',
                applied_filters: {
                    asset_families: ['nutrient_workbook'],
                    source_types: ['xlsx'],
                    topic_minor: 'drain_feedback',
                },
                routing: {
                    intent: 'nutrient_recipe',
                    sub_intent: 'drain_feedback',
                },
                database: {
                    status: 'ready',
                },
                results: [
                    {
                        score: 0.92,
                        text: '칼슘 기준과 배액 피드백을 함께 확인합니다.',
                        topic_major: 'nutrient_recipe',
                        topic_minor: 'drain_feedback',
                        source_locator: '양액 시트 12행',
                        document: {
                            title: '토마토 양액 워크북',
                            filename: 'nutrient.xlsx',
                            relative_path: 'data/nutrient.xlsx',
                            asset_family: 'nutrient_workbook',
                            source_type: 'xlsx',
                            crop_scopes: ['tomato'],
                        },
                    },
                ],
            }),
        });

        renderDrawer({
            preset: 'nutrient',
            query: '토마토 양액 기준',
            autoRun: true,
            source: 'advisor',
        });

        expect(await screen.findByText('검색 결과: 1')).toBeTruthy();
        expect(screen.getByText(/자동 분류: 양액 처방 \/ 배액 피드백/)).toBeTruthy();
        expect(screen.getByText(/적용 범위: 양액 워크북 · 엑셀 문서 · 배액 피드백 · 토마토/)).toBeTruthy();
        expect(screen.getByText('문서 위치: 양액 시트 12행')).toBeTruthy();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('hides the internal reindex route when the knowledge database is missing', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                query_status: 'database_missing',
                query_mode: 'database_missing',
                returned_count: 0,
                database: {
                    status: 'missing',
                },
                applied_filters: {
                    asset_families: ['pesticide_workbook'],
                },
                routing: {
                    intent: 'disease_pest',
                },
                results: [],
            }),
        });

        renderDrawer({
            preset: 'pesticide',
            query: '토마토 병해충 기준',
            autoRun: true,
            source: 'advisor',
        });

        expect(await screen.findByText('자료를 정리 중입니다. 잠시 후 다시 시도해 주세요.')).toBeTruthy();
        expect(screen.queryByText(/reindex/i)).toBeNull();
    });
});
