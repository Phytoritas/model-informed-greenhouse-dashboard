import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PageSectionTabs from './PageSectionTabs';

describe('PageSectionTabs', () => {
    it('returns nothing when the tab list is empty', () => {
        const { container } = render(<PageSectionTabs tabs={[]} />);

        expect(container.firstChild).toBeNull();
    });

    it('marks the active tab and notifies on selection', () => {
        const onSelect = vi.fn();

        render(
            <PageSectionTabs
                tabs={[
                    { id: 'overview-hero', label: '핵심 판단' },
                    { id: 'overview-live', label: '실시간 상태' },
                ]}
                activeId="overview-live"
                onSelect={onSelect}
            />,
        );

        const heroTab = screen.getByRole('button', { name: '핵심 판단' });
        const liveTab = screen.getByRole('button', { name: '실시간 상태' });

        expect(heroTab.getAttribute('data-active')).not.toBe('true');
        expect(liveTab.getAttribute('data-active')).toBe('true');

        fireEvent.click(heroTab);

        expect(onSelect).toHaveBeenCalledWith('overview-hero');
    });
});
