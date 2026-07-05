import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppShell from './AppShell';

describe('AppShell', () => {
    it('renders header and content inside the shared compact overview frame', () => {
        const { container } = render(
            <AppShell header={<div data-testid="header-probe">Header</div>}>
                <div data-testid="body-probe">Body</div>
            </AppShell>,
        );

        expect(screen.getByTestId('header-probe')).toBeTruthy();
        expect(screen.getByTestId('body-probe')).toBeTruthy();
        // Same canvas classes as the HOME landing page so route widths match.
        expect(container.querySelector('.overview-browser-shell')).toBeTruthy();
        expect(container.querySelector('.overview-browser-frame')).toBeTruthy();
        expect(container.querySelector('.overview-frame-body')).toBeTruthy();
    });
});
