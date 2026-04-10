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
                            label: '오늘 운영',
                            shortLabel: '오늘',
                            description: '지금 상태와 오늘 할 일을 먼저 봅니다.',
                            icon: Sprout,
                        },
                        {
                            key: 'control',
                            label: '환경 제어',
                            shortLabel: '제어',
                            description: '지금 조치와 온도 전략을 함께 봅니다.',
                            icon: Leaf,
                        },
                    ]}
                    activeWorkspace="overview"
                    statusLabel="센서 정상"
                    onSelect={onSelect}
                />
            </LocaleProvider>,
        );

        const overviewButtons = screen.getAllByRole('button', { name: /오늘 운영|오늘/ });
        const controlButtons = screen.getAllByRole('button', { name: /환경 제어|제어/ });

        expect(overviewButtons.some((button) => button.getAttribute('aria-current') === 'page')).toBe(true);
        expect(controlButtons.every((button) => button.getAttribute('aria-current') !== 'page')).toBe(true);

        fireEvent.click(controlButtons[0]!);

        expect(onSelect).toHaveBeenCalledWith('control');
        expect(screen.getByText('PhytoSync')).toBeTruthy();
        expect(screen.getByText('센서 정상')).toBeTruthy();
    });
});
