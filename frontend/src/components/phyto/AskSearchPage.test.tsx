import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AskSearchPage from './AskSearchPage';

describe('AskSearchPage', () => {
    it('renders the Korean ask and search flow and dispatches quick actions', () => {
        const onOpenAsk = vi.fn();
        const onOpenSearch = vi.fn();
        const onQuickSearch = vi.fn();

        render(
            <AskSearchPage
                locale="ko"
                cropLabel="오이"
                summary={{
                    cropKey: 'cucumber',
                    surfaces: [],
                    advisorySurfaceNames: ['양액', '방제'],
                    pendingParsers: ['PDF'],
                    pesticideReady: true,
                    nutrientReady: true,
                    nutrientCorrectionReady: false,
                    nutrientCorrectionDraftMode: null,
                    nutrientCorrectionLimitation: null,
                }}
                actionsNow={['지금 환기 편차를 보수적으로 유지합니다.']}
                actionsToday={['야간 습도 상승 구간을 먼저 확인합니다.']}
                note="자료를 찾은 뒤 바로 다음 운영 판단으로 이어가세요."
                signals={[
                    { label: '센서 상태', value: '실시간 · 2분 전' },
                    { label: '시장', value: '오이 12,400원' },
                ]}
                onOpenAsk={onOpenAsk}
                onOpenSearch={onOpenSearch}
                onQuickSearch={onQuickSearch}
            />,
        );

        expect(screen.getByRole('heading', { name: /오이 운영 질문을 바로 시작하세요/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: '질문하기' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '자료 찾기' })).toBeTruthy();
        expect(screen.getByText('지금 이어지는 질문 맥락')).toBeTruthy();
        expect(screen.getByText('검색 뒤에 열릴 운영 도구')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: '질문하기' }));
        fireEvent.click(screen.getByRole('button', { name: '자료 찾기' }));
        fireEvent.click(screen.getAllByRole('button', { name: /바로 찾기/ })[0]);

        expect(onOpenAsk).toHaveBeenCalledTimes(1);
        expect(onOpenSearch).toHaveBeenCalledTimes(1);
        expect(onQuickSearch).toHaveBeenCalledTimes(1);
    });
});
