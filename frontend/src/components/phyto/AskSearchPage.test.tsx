import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AskSearchPage from './AskSearchPage';

const baseProps = {
    locale: 'ko' as const,
    crop: 'Cucumber' as const,
    cropLabel: '오이',
    summary: {
        cropKey: 'cucumber',
        surfaces: [],
        advisorySurfaceNames: ['양액', '방제'],
        pendingParsers: ['PDF'],
        pesticideReady: true,
        nutrientReady: true,
        nutrientCorrectionReady: false,
        nutrientCorrectionDraftMode: null,
        nutrientCorrectionLimitation: null,
    },
    actionsNow: ['지금 환기 편차를 보수적으로 유지합니다.'],
    actionsToday: ['야간 습도 상승 구간을 먼저 확인합니다.'],
    note: '자료를 찾은 뒤 바로 다음 운영 판단으로 이어가세요.',
    signals: [
        { label: '센서 상태', value: '실시간 · 2분 전' },
        { label: '시장', value: '오이 12,400원' },
    ],
};

describe('AskSearchPage', () => {
    it('renders only the ask composer by default', () => {
        const onOpenAsk = vi.fn();
        const onOpenSearch = vi.fn();

        render(
            <AskSearchPage
                {...baseProps}
                onOpenAsk={onOpenAsk}
                onOpenSearch={onOpenSearch}
            />,
        );

        expect(screen.getByRole('heading', { name: /오이 운영 질문을 바로 시작하세요/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: '질문하기' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '자료 찾기' })).toBeTruthy();
        expect(screen.queryByRole('heading', { name: '질문 흐름 안에서 바로 자료를 찾습니다' })).toBeNull();
        expect(screen.queryByText('지금 이어지는 질문 맥락')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: '질문하기' }));
        fireEvent.click(screen.getByRole('button', { name: '자료 찾기' }));

        expect(onOpenAsk).toHaveBeenCalledTimes(1);
        expect(onOpenSearch).toHaveBeenCalledTimes(1);
    });

    it('renders only the inline knowledge board on the search panel', () => {
        render(
            <AskSearchPage
                {...baseProps}
                activePanel="ask-search"
                onOpenAsk={vi.fn()}
                onOpenSearch={vi.fn()}
            />,
        );

        expect(screen.getByRole('heading', { name: '질문 흐름 안에서 바로 자료를 찾습니다' })).toBeTruthy();
        expect(screen.getByText('질문하기를 열지 않아도, 이 화면 안에서 바로 검색하고 연결된 문서를 읽을 수 있습니다.')).toBeTruthy();
        expect(screen.queryByRole('heading', { name: /오이 운영 질문을 바로 시작하세요/ })).toBeNull();
        expect(screen.queryByText('지금 이어지는 질문 맥락')).toBeNull();
    });

    it('renders only the recent-flow summary on the history panel', () => {
        render(
            <AskSearchPage
                {...baseProps}
                activePanel="ask-history"
                onOpenAsk={vi.fn()}
                onOpenSearch={vi.fn()}
            />,
        );

        expect(screen.getByText('지금 이어지는 질문 맥락')).toBeTruthy();
        expect(screen.getByText('검색 뒤에 열릴 운영 도구')).toBeTruthy();
        expect(screen.queryByRole('heading', { name: /오이 운영 질문을 바로 시작하세요/ })).toBeNull();
        expect(screen.queryByRole('heading', { name: '질문 흐름 안에서 바로 자료를 찾습니다' })).toBeNull();
    });
});
