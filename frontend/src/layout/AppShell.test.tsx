import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppShell from './AppShell';

describe('AppShell', () => {
    it('keeps the sidebar slot mounted on mobile-sized layouts', () => {
        render(
            <AppShell
                header={<div>Header</div>}
                sidebar={<div data-testid="sidebar-probe">Sidebar</div>}
            >
                <div>Body</div>
            </AppShell>,
        );

        const sidebarSlot = screen.getByTestId('app-shell-sidebar-slot');

        expect(screen.getByTestId('sidebar-probe')).toBeTruthy();
        expect(sidebarSlot.className).not.toContain('hidden');
        expect(sidebarSlot.className).toContain('lg:w-[240px]');
    });
});
