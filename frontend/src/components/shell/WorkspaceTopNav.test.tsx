import { fireEvent, render, screen } from '@testing-library/react';
import { Leaf } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { GLOBAL_NAVIGATION_ITEMS } from '../../routes/globalNavigation';
import WorkspaceTopNav, { type WorkspaceNavItem } from './WorkspaceTopNav';

const ITEMS: WorkspaceNavItem[] = [
  {
    key: 'command',
    label: 'Today',
    shortLabel: 'Today',
    description: 'Today operations',
    icon: Leaf,
  },
  {
    key: 'control',
    label: 'Control',
    shortLabel: 'Control',
    description: 'Greenhouse environment',
    icon: Leaf,
    actions: [
      { id: 'control-strategy', label: 'Strategy' },
      { id: 'control-devices', label: 'Devices' },
    ],
  },
];

describe('WorkspaceTopNav', () => {
  it('renders the shared global navigation with the active top-level page', () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <WorkspaceTopNav
            globalItems={GLOBAL_NAVIGATION_ITEMS}
            items={ITEMS}
            activeGlobalKey="dashboard"
            activeWorkspace="control"
            onSelect={() => undefined}
          />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.getByRole('navigation', { name: 'Global navigation' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'HOME' }).getAttribute('href')).toBe('/overview');
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('href')).toBe('/control');
    expect(screen.getByRole('link', { name: 'INSIGHTS' }).getAttribute('href')).toBe('/trend');
    expect(screen.getByRole('link', { name: 'SCENARIOS' }).getAttribute('href')).toBe('/scenarios');
    expect(screen.getByRole('link', { name: 'KNOWLEDGE' }).getAttribute('href')).toBe('/assistant');
    expect(screen.getByRole('button', { name: 'CONTACT' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'HOME' }).getAttribute('aria-current')).toBeNull();
  });

  it('renders category subtabs with aria-current step on the active subtab', () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <WorkspaceTopNav
            globalItems={GLOBAL_NAVIGATION_ITEMS}
            items={ITEMS}
            activeGlobalKey="dashboard"
            activeWorkspace="control"
            onSelect={() => undefined}
          />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-current')).toBeNull();
  });

  it('renders the active workspace sub-actions and forwards selections', () => {
    const onSelectAction = vi.fn();
    render(
      <LocaleProvider>
        <MemoryRouter>
          <WorkspaceTopNav
            globalItems={GLOBAL_NAVIGATION_ITEMS}
            items={ITEMS}
            activeGlobalKey="dashboard"
            activeWorkspace="control"
            activeActionId="control-strategy"
            onSelect={() => undefined}
            onSelectAction={onSelectAction}
          />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.getByRole('button', { name: 'Strategy' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Devices' }));
    expect(onSelectAction).toHaveBeenCalledWith('control', 'control-devices');
  });

  it('renders no sub-action row for a workspace without actions', () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <WorkspaceTopNav
            globalItems={GLOBAL_NAVIGATION_ITEMS}
            items={ITEMS}
            activeGlobalKey="home"
            activeWorkspace="command"
            onSelect={() => undefined}
            onSelectAction={() => undefined}
          />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.queryByTestId('workspace-top-nav-actions')).toBeNull();
  });
});
