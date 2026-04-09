import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import TopBar from './TopBar';

function renderTopBar(locale: 'ko' | 'en' = 'ko') {
    const onLocaleChange = vi.fn();
    const onCropChange = vi.fn();
    const onAssistantToggle = vi.fn();

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
                assistantOpen={false}
                getCropLabel={(crop, currentLocale) => (currentLocale === 'ko' ? (crop === 'Cucumber' ? '오이' : '토마토') : crop)}
            />
        </LocaleProvider>,
    );

    return { onLocaleChange, onCropChange, onAssistantToggle };
}

describe('TopBar', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('renders Korean search copy and triggers assistant toggle', () => {
        const { onAssistantToggle, onLocaleChange, onCropChange } = renderTopBar('ko');

        expect(screen.getByRole('heading', { name: '오늘 한눈에' })).toBeTruthy();
        expect(screen.getByLabelText('동, 작업, 자재를 바로 찾기')).toBeTruthy();
        expect(screen.getByPlaceholderText('동, 작업, 자재를 바로 찾기')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: '질문하기' }));
        fireEvent.click(screen.getByRole('button', { name: 'EN' }));
        fireEvent.click(screen.getByRole('button', { name: '오이' }));

        expect(onAssistantToggle).toHaveBeenCalledTimes(1);
        expect(onLocaleChange).toHaveBeenCalledWith('en');
        expect(onCropChange).toHaveBeenCalledWith('Cucumber');
    });

    it('renders English copy for search and controls', () => {
        renderTopBar('en');

        expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
        expect(screen.getByLabelText('Search work, materials, or houses')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Ask' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Cucumber' })).toBeTruthy();
    });
});
