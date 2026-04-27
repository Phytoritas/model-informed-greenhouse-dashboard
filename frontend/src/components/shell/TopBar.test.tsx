import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import TopBar from './TopBar';

function renderTopBar(locale: 'ko' | 'en' = 'ko') {
    const onLocaleChange = vi.fn();
    const onCropChange = vi.fn();
    const onAssistantToggle = vi.fn();
    const onOpenAlerts = vi.fn();
    const onSearchSubmit = vi.fn();
    const onOpenSettings = vi.fn();

    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);

    render(
        <LocaleProvider>
            <TopBar
                locale={locale}
                selectedCrop="Cucumber"
                telemetryStatus="live"
                telemetryDetail={locale === 'ko' ? '09:30 · 2분 전' : '09:30 · 2m ago'}
                pageTitle={locale === 'ko' ? '오늘 한눈에' : 'Overview'}
                pageDescription={locale === 'ko' ? '오늘 운영 판단을 먼저 정리합니다.' : 'Start from today’s operating posture.'}
                onLocaleChange={onLocaleChange}
                onCropChange={onCropChange}
                onAssistantToggle={onAssistantToggle}
                onOpenAlerts={onOpenAlerts}
                onSearchSubmit={onSearchSubmit}
                onOpenSettings={onOpenSettings}
                assistantOpen={false}
                getCropLabel={(crop, currentLocale) => (currentLocale === 'ko' ? (crop === 'Cucumber' ? '오이' : '토마토') : crop)}
            />
        </LocaleProvider>,
    );

    return { onLocaleChange, onCropChange, onAssistantToggle, onOpenAlerts, onSearchSubmit, onOpenSettings };
}

describe('TopBar', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('renders Korean search copy and triggers assistant toggle', () => {
        const { onAssistantToggle, onOpenAlerts, onLocaleChange, onCropChange, onSearchSubmit } = renderTopBar('ko');

        expect(screen.getByRole('heading', { name: '오늘 한눈에' })).toBeTruthy();
        expect(screen.getByText('오늘 운영 판단을 먼저 정리합니다.')).toBeTruthy();
        expect(screen.getByLabelText('온실, 시세, 생육 등 현황 확인하기')).toBeTruthy();
        expect(screen.getByPlaceholderText('온실, 시세, 생육 등 현황 확인하기')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: '질문 도우미' }));
        fireEvent.click(screen.getByRole('button', { name: '긴급 알림' }));
        fireEvent.click(screen.getByRole('button', { name: 'EN' }));
        fireEvent.click(screen.getByRole('button', { name: '오이' }));
        fireEvent.change(screen.getByLabelText('온실, 시세, 생육 등 현황 확인하기'), { target: { value: '현재 온실 상태 요약' } });
        fireEvent.keyDown(screen.getByLabelText('온실, 시세, 생육 등 현황 확인하기'), { key: 'Enter' });

        expect(onAssistantToggle).toHaveBeenCalledTimes(1);
        expect(onOpenAlerts).toHaveBeenCalledTimes(1);
        expect(onLocaleChange).toHaveBeenCalledWith('en');
        expect(onCropChange).toHaveBeenCalledWith('Cucumber');
        expect(onSearchSubmit).toHaveBeenCalledWith('현재 온실 상태 요약');
    });

    it('renders English copy for search and controls', () => {
        renderTopBar('en');

        expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
        expect(screen.getByLabelText('Search climate, scenarios, knowledge, or market signals')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Assistant' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Cucumber' })).toBeTruthy();
    });
});
