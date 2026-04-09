import { fireEvent, render, screen } from '@testing-library/react';
import { Leaf, Sprout } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import WorkspaceNav from './WorkspaceNav';

describe('WorkspaceNav', () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ko');
    });

    it('marks the active section and notifies when another section is chosen', () => {
        const onSelect = vi.fn();

        render(
            <LocaleProvider>
                <WorkspaceNav
                    items={[
                        {
                            key: 'overview',
                            label: '오늘 한눈에',
                            shortLabel: '개요',
                            description: '상태와 오늘 운영 방향을 먼저 봅니다.',
                            icon: Sprout,
                        },
                        {
                            key: 'growth',
                            label: '생육·작업',
                            shortLabel: '생육',
                            description: '세력과 작업 흐름을 함께 확인합니다.',
                            icon: Leaf,
                        },
                    ]}
                    activeWorkspace="overview"
                    onSelect={onSelect}
                />
            </LocaleProvider>,
        );

        const overviewButtons = screen.getAllByRole('button', { name: /오늘 한눈에|개요/ });
        const growthButtons = screen.getAllByRole('button', { name: /생육·작업|생육/ });

        expect(overviewButtons.some((button) => button.getAttribute('aria-current') === 'page')).toBe(true);
        expect(growthButtons.every((button) => button.getAttribute('aria-current') !== 'page')).toBe(true);

        fireEvent.click(growthButtons[0]!);

        expect(onSelect).toHaveBeenCalledWith('growth');
        expect(screen.getByText('메뉴')).toBeTruthy();
    });
});
