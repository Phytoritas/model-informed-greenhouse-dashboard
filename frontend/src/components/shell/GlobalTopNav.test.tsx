import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import GlobalTopNav from './GlobalTopNav';

function renderNav(props: Partial<Parameters<typeof GlobalTopNav>[0]> = {}) {
  return render(
    <LocaleProvider>
      <MemoryRouter>
        <GlobalTopNav onOpenAssistant={() => undefined} {...props} />
      </MemoryRouter>
    </LocaleProvider>,
  );
}

describe('GlobalTopNav', () => {
  beforeEach(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  });

  it('renders the task destinations without a promotional contact tab', () => {
    renderNav();

    expect(screen.getByRole('link', { name: 'HOME' }).getAttribute('href')).toBe('/overview');
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('href')).toBe('/control');
    expect(screen.getByRole('link', { name: 'INSIGHTS' }).getAttribute('href')).toBe('/trend');
    expect(screen.getByRole('link', { name: 'SCENARIOS' }).getAttribute('href')).toBe('/scenarios');
    expect(screen.getByRole('link', { name: 'KNOWLEDGE' }).getAttribute('href')).toBe('/assistant');
    expect(screen.queryByRole('link', { name: 'CONTACT' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'CONTACT' })).toBeNull();
  });

  it('marks the active key with aria-current and defaults to HOME', () => {
    renderNav();

    expect(screen.getByRole('link', { name: 'HOME' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks a non-home active key on routed workspace screens', () => {
    renderNav({ activeKey: 'knowledge' });

    expect(screen.getByRole('link', { name: 'KNOWLEDGE' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'HOME' }).getAttribute('aria-current')).toBeNull();
  });

  it('forwards assistant and navigation callbacks', () => {
    const onOpenAssistant = vi.fn();
    const onNavigate = vi.fn();
    renderNav({ onOpenAssistant, onNavigate });

    fireEvent.click(screen.getByRole('button', { name: 'Ask Assistant' }));
    expect(onOpenAssistant).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('link', { name: 'KNOWLEDGE' }));
    expect(onNavigate).toHaveBeenCalledWith('knowledge');

    fireEvent.click(screen.getByRole('link', { name: 'Open Dashboard' }));
    expect(onNavigate).toHaveBeenCalledWith('dashboard');
  });
});
