import { fireEvent, render, screen } from '@testing-library/react';
import { Leaf } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import type { WorkspaceNavItem } from './WorkspaceNav';
import WorkspaceTopNav from './WorkspaceTopNav';

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
  it('renders route buttons with aria-current on the active workspace', () => {
    render(
      <LocaleProvider>
        <WorkspaceTopNav items={ITEMS} activeWorkspace="control" onSelect={() => undefined} />
      </LocaleProvider>,
    );

    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-current')).toBeNull();
  });

  it('renders the active workspace sub-actions and forwards selections', () => {
    const onSelectAction = vi.fn();
    render(
      <LocaleProvider>
        <WorkspaceTopNav
          items={ITEMS}
          activeWorkspace="control"
          activeActionId="control-strategy"
          onSelect={() => undefined}
          onSelectAction={onSelectAction}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole('button', { name: 'Strategy' }).getAttribute('aria-current')).toBe('step');

    fireEvent.click(screen.getByRole('button', { name: 'Devices' }));
    expect(onSelectAction).toHaveBeenCalledWith('control', 'control-devices');
  });

  it('renders no sub-action row for a workspace without actions', () => {
    render(
      <LocaleProvider>
        <WorkspaceTopNav items={ITEMS} activeWorkspace="command" onSelect={() => undefined} onSelectAction={() => undefined} />
      </LocaleProvider>,
    );

    expect(screen.queryByTestId('workspace-top-nav-actions')).toBeNull();
  });
});
