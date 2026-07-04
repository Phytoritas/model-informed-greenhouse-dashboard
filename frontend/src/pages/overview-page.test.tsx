import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OverviewPage from './overview-page';
import { LocaleProvider } from '../i18n/LocaleProvider';

describe('OverviewPage', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
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

  it('scrolls hash and sidebar action targets to the matching overview section', async () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/overview#overview-watch']}>
          <OverviewPage
            topNavigation={<div>nav</div>}
            heroDecisionBrief={<section id="overview-core" tabIndex={-1}>core</section>}
            liveMetricStrip={<section id="overview-dashboard" tabIndex={-1}>dashboard</section>}
            todayActionBoard={<section id="overview-watch" tabIndex={-1}>watch</section>}
            scenarioOptimizerPreview={<section id="scenario-optimizer">scenario</section>}
            weatherMarketKnowledgeBridge={<section id="overview-bridge">bridge</section>}
            finalCta={<section id="contact">contact</section>}
            footer={<footer>footer</footer>}
            activeTabId="overview-core"
          />
        </MemoryRouter>
      </LocaleProvider>,
    );

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(document.activeElement?.id).toBe('overview-watch');
  });

  it('verify_src001_s0002_r002_a01 renders overview tabs through the shared toggle group contract', () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/overview']}>
          <OverviewPage
            topNavigation={<div>nav</div>}
            heroDecisionBrief={<section id="overview-core" tabIndex={-1}>core</section>}
            liveMetricStrip={<section id="live-overview" tabIndex={-1}>metrics</section>}
            todayActionBoard={<section id="today-action-board" tabIndex={-1}>actions</section>}
            scenarioOptimizerPreview={<section id="scenario-optimizer">scenario</section>}
            weatherMarketKnowledgeBridge={<section id="overview-bridge">bridge</section>}
            finalCta={<section id="contact">contact</section>}
            footer={<footer>footer</footer>}
            activeTabId="overview-core"
          />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.getByRole('tablist', { name: 'Overview tabs' }).className).toContain('overview-tab-strip');
    expect(screen.getByRole('tab', { name: /Command/ }).getAttribute('aria-selected')).toBe('true');
  });
});
