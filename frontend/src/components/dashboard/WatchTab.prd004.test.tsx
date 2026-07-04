import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import AlertRail, { type AlertRailItem } from './AlertRail';
import TodayBoard from './TodayBoard';

function renderWithLocale(ui: ReactNode) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');

  return render(
    <LocaleProvider>
      {ui}
    </LocaleProvider>,
  );
}

function requireClosestPanel(element: HTMLElement) {
  const panel = element.closest('.sg-panel');
  expect(panel).toBeTruthy();
  return panel as HTMLElement;
}

function expectChipTone(label: string, toneToken: string) {
  expect(
    screen.getAllByText(label).some((chip) => chip.getAttribute('class')?.includes(toneToken)),
  ).toBe(true);
}

describe('PRD-004 Watch tab acceptance', () => {
  it('verify_src001_s0004_r001_a01 renders AlertRail alert cards as sg-panel surfaces with severity StatusChip tones', () => {
    const alerts: AlertRailItem[] = [
      {
        id: 'critical-root',
        severity: 'critical',
        title: 'Critical root-zone drop',
        body: 'Root-zone water potential is below the immediate intervention threshold.',
      },
      {
        id: 'warning-vpd',
        severity: 'warning',
        title: 'VPD is drifting',
        body: 'VPD is trending outside the operating band for the evening.',
      },
      {
        id: 'info-note',
        severity: 'info',
        title: 'Log evening scout',
        body: 'Record the pest scout note before the night shift.',
      },
      {
        id: 'resolved-rtr',
        severity: 'resolved',
        title: 'RTR setpoint confirmed',
        body: 'The target temperature check has been completed.',
      },
    ];

    renderWithLocale(<AlertRail items={alerts} />);

    expectChipTone('Act now', '--sg-status-offline-bg');
    expectChipTone('Review', '--sg-status-delayed-bg');
    expectChipTone('Operating note', '--sg-status-stale-bg');
    expectChipTone('Resolved', '--sg-status-live-bg');

    expect(requireClosestPanel(screen.getByText('Critical root-zone drop')).getAttribute('class')).toContain('bg-[color:var(--sg-color-primary-soft)]');
    expect(requireClosestPanel(screen.getByText('VPD is drifting')).getAttribute('class')).toContain('bg-[color:var(--sg-accent-amber-soft)]');
    expect(requireClosestPanel(screen.getByText('Log evening scout')).getAttribute('class')).toContain('bg-[color:var(--sg-surface-warm)]');
    expect(requireClosestPanel(screen.getByText('RTR setpoint confirmed')).getAttribute('class')).toContain('bg-[color:var(--sg-color-sage-soft)]');
  });

  it('verify_src001_s0004_r002_a01 renders TodayBoard with Command-style title-icon chips and bottom-right CTA buttons', () => {
    const onOpenAdvisor = vi.fn();
    const onOpenRtr = vi.fn();

    renderWithLocale(
      <TodayBoard
        actionsNow={['Open ridge vents before VPD exceeds the evening band.']}
        actionsToday={['Move the irrigation window before midday.']}
        actionsWeek={['Review weekly RTR target against harvest outlook.']}
        monitor={['Watch humidity drift after sunset.']}
        onOpenAdvisor={onOpenAdvisor}
        onOpenRtr={onOpenRtr}
      />,
    );

    const expectedCards = [
      { title: 'Now', chip: 'High impact', action: 'See Details' },
      { title: 'Today', chip: 'Moderate', action: 'See Details' },
      { title: 'This week', chip: 'Moderate', action: 'Compare' },
      { title: 'Watch', chip: 'Watch', action: 'See Details' },
    ];

    for (const expected of expectedCards) {
      const card = requireClosestPanel(screen.getByRole('heading', { name: expected.title }));
      expect(card.tagName).toBe('SECTION');
      expect(card.querySelector('svg')).toBeTruthy();
      expect(
        within(card).getAllByText(expected.chip).some((node) => node.getAttribute('class')?.includes('--sg-status-')),
      ).toBe(true);

      const cta = within(card).getByRole('button', { name: expected.action });
      expect(cta.parentElement?.getAttribute('class')).toContain('justify-between');
    }

    fireEvent.click(within(requireClosestPanel(screen.getByRole('heading', { name: 'Now' }))).getByRole('button', { name: 'See Details' }));
    fireEvent.click(within(requireClosestPanel(screen.getByRole('heading', { name: 'Today' }))).getByRole('button', { name: 'See Details' }));
    fireEvent.click(within(requireClosestPanel(screen.getByRole('heading', { name: 'Watch' }))).getByRole('button', { name: 'See Details' }));
    fireEvent.click(within(requireClosestPanel(screen.getByRole('heading', { name: 'This week' }))).getByRole('button', { name: 'Compare' }));

    expect(onOpenAdvisor).toHaveBeenCalledTimes(3);
    expect(onOpenRtr).toHaveBeenCalledTimes(1);
  });
});
