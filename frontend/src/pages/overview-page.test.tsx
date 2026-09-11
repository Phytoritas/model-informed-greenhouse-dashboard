import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OverviewPage from './overview-page';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../i18n/locale';

const sections = {
  topNavigation: <nav>navigation</nav>,
  pageHeader: <h1>Today’s greenhouse</h1>,
  metricRow: <div>latest metrics</div>,
  scene: <div>greenhouse scene</div>,
  decisionBoard: <section aria-label="Decision board">decision board</section>,
  chartRow: <div>environment charts</div>,
  dashboardTab: <div>detailed metrics</div>,
  watchTab: <div>current alerts</div>,
};

function renderPage(activeTabId = 'overview-core', path = '/overview') {
  return render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[path]}>
        <OverviewPage {...sections} activeTabId={activeTabId} />
      </MemoryRouter>
    </LocaleProvider>,
  );
}

describe('OverviewPage', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    scrollIntoView.mockClear();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('scrolls and focuses the requested alerts panel', async () => {
    renderPage('overview-watch', '/overview#overview-watch');

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(document.activeElement?.id).toBe('overview-watch');
    expect(screen.getByText('current alerts')).toBeTruthy();
    expect(screen.queryByText('decision board')).toBeNull();
  });

  it('shows one decision board with the greenhouse, latest metrics, and charts on Today', () => {
    renderPage();

    expect(screen.getAllByRole('region', { name: 'Decision board' })).toHaveLength(1);
    expect(screen.getByText('greenhouse scene')).toBeTruthy();
    expect(screen.getByText('latest metrics')).toBeTruthy();
    expect(screen.getByText('environment charts')).toBeTruthy();
    expect(screen.queryByText('detailed metrics')).toBeNull();
    expect(screen.queryByText('current alerts')).toBeNull();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('exposes the selected metrics tab and renders only its detailed content', () => {
    renderPage('overview-dashboard');

    expect(screen.getByRole('tablist', { name: 'Overview tabs' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Today/ }).getAttribute('aria-selected')).toBe('false');
    const metricsTab = screen.getByRole('tab', { name: /Metrics/ });
    expect(metricsTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').id).toBe(metricsTab.getAttribute('aria-controls'));
    expect(screen.getByText('detailed metrics')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Decision board' })).toBeNull();
    expect(screen.queryByText('current alerts')).toBeNull();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });
});
