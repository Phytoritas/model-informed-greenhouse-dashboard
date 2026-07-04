import { fireEvent, render, screen } from '@testing-library/react';
import { Leaf } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
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
  it('renders no global navigation row — that lives in the shared GlobalTopNav header', () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <WorkspaceTopNav
            items={ITEMS}
            activeWorkspace="control"
            onSelect={() => undefined}
          />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.queryByTestId('workspace-global-nav')).toBeNull();
    expect(screen.queryByRole('link', { name: 'HOME' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'CONTACT' })).toBeNull();
  });

  it('renders category subtabs with aria-current step on the active subtab', () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <WorkspaceTopNav
            items={ITEMS}
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
            items={ITEMS}
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
            items={ITEMS}
            activeWorkspace="command"
            onSelect={() => undefined}
            onSelectAction={() => undefined}
          />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.queryByTestId('workspace-top-nav-actions')).toBeNull();
  });

  it('renders nothing when the active category has no subtabs', () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <WorkspaceTopNav
            items={[]}
            activeWorkspace="contact"
            onSelect={() => undefined}
          />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.queryByTestId('workspace-top-nav')).toBeNull();
  });
});
