import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from './i18n/LocaleProvider'
import { LOCALE_STORAGE_KEY } from './i18n/locale'

const greenhouseState = {
  currentData: {
    timestamp: Date.now(),
    temperature: 22.4,
    humidity: 67,
    co2: 540,
    light: 410,
    vpd: 1.12,
    stomatalConductance: 0.34,
    photosynthesis: 16.8,
  },
  modelMetrics: {
    energy: {
      consumption: 12.4,
      efficiency: 3.18,
    },
    growth: {
      lai: 3.2,
      developmentStage: 'vegetative',
    },
    yield: {
      predictedWeekly: 126.5,
    },
  },
  history: [
    {
      timestamp: Date.now() - 3_600_000,
      temperature: 21.8,
      humidity: 69,
      co2: 520,
      light: 320,
      vpd: 1.04,
      stomatalConductance: 0.31,
      photosynthesis: 14.2,
      fieldAvailability: {
        temperature: true,
        humidity: true,
        co2: true,
        light: true,
        vpd: true,
        stomatalConductance: true,
      },
    },
    {
      timestamp: Date.now(),
      temperature: 22.4,
      humidity: 67,
      co2: 540,
      light: 410,
      vpd: 1.12,
      stomatalConductance: 0.34,
      photosynthesis: 16.8,
      fieldAvailability: {
        temperature: true,
        humidity: true,
        co2: true,
        light: true,
        vpd: true,
        stomatalConductance: true,
      },
    },
  ],
  metricHistory: [],
  forecast: [],
  controls: {
    settings: {
      heatingMinTemp: 18,
      coolingTargetTemp: 24,
    },
  },
  toggleControl: vi.fn(),
  setControlValue: vi.fn(),
  selectedCrop: 'Cucumber' as const,
  setSelectedCrop: vi.fn(),
  telemetry: {
    status: 'live' as const,
    lastMessageAt: Date.now(),
  },
  sensorFieldAvailability: {
    temperature: true,
    humidity: true,
    co2: true,
    light: true,
    vpd: true,
    stomatalConductance: true,
  },
  sensorFieldTimestamps: {
    temperature: Date.now(),
    humidity: Date.now(),
    co2: Date.now(),
    light: Date.now(),
    vpd: Date.now(),
    stomatalConductance: Date.now(),
  },
  setTempSettings: vi.fn(),
  growthDay: 14,
  startDateLabel: '2026-04-01',
  currentDateLabel: '2026-04-09',
}

const advisorState = {
  aiAnalysis: null,
  aiDisplay: {
    actions_now: ['Keep night temperature steady.'],
    actions_today: ['Review humidity after sunset.'],
    actions_week: ['Prepare harvest labor for Friday.'],
    monitor: ['Watch RH drift after 18:00.'],
    confidence: 0.82,
    risks: [],
  },
  aiModelRuntime: {
    summary: 'Balanced operating recommendation ready.',
    scenario: {
      recommended: {
        action: 'Hold the night average temperature +0.4°C.',
      },
      confidence: 0.79,
    },
    recommendations: [{ action: 'Keep vent bias conservative.' }],
    constraint_checks: {
      violated_constraints: [],
    },
    state_snapshot: {
      source_sink_balance: 0.42,
      canopy_net_assimilation_umol_m2_s: 16.8,
      lai: 3.2,
    },
  },
  aiError: null,
  isAnalyzing: false,
  analyzeData: vi.fn(),
}

vi.mock('./hooks/useGreenhouse', () => ({
  useGreenhouse: () => greenhouseState,
}))

vi.mock('./hooks/useAiAssistant', () => ({
  useAiAssistant: () => advisorState,
}))

vi.mock('./hooks/useWeatherOutlook', () => ({
  useWeatherOutlook: () => ({
    weather: {
      current: {
        temperature_c: 17.8,
        weather_label: 'Clear',
      },
    },
    loading: false,
    error: null,
  }),
}))

vi.mock('./hooks/useProducePrices', () => ({
  useProducePrices: () => ({
    prices: {
      source: {
        fetched_at: '2026-04-09T09:00:00Z',
      },
      items: [
        {
          display_name: 'Cucumber',
          current_price_krw: 12400,
        },
      ],
    },
    loading: false,
    error: null,
  }),
}))

vi.mock('./hooks/useRtrProfiles', () => ({
  useRtrProfiles: () => ({
    profiles: {
      optimizerEnabled: true,
      profiles: {
        Cucumber: {
          strategyLabel: 'Balanced lane',
          optimizer: {
            enabled: true,
          },
        },
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('./hooks/useSmartGrowKnowledge', () => ({
  useSmartGrowKnowledge: () => ({
    summary: {
      surfaces: [{ status: 'ready' }],
      advisorySurfaceNames: ['Nutrient', 'Protection'],
      pendingParsers: [],
      nutrientReady: true,
      pesticideReady: true,
      nutrientCorrectionReady: false,
    },
    loading: false,
    error: null,
  }),
}))

vi.mock('./layout/AppShell', () => ({
  default: ({ header, sidebar, children }: { header: ReactNode; sidebar: ReactNode; children: ReactNode }) => (
    <div>
      <div data-testid="app-topbar">{header}</div>
      <div data-testid="app-sidebar">{sidebar}</div>
      <main>{children}</main>
    </div>
  ),
}))

vi.mock('./components/shell/TopBar', () => ({
  default: ({
    pageTitle,
    onAssistantToggle,
  }: {
    pageTitle: string
    onAssistantToggle?: () => void
  }) => (
    <div>
      <div data-testid="topbar-title">{pageTitle}</div>
      <button type="button" onClick={onAssistantToggle}>Toggle assistant</button>
    </div>
  ),
}))

vi.mock('./components/shell/WorkspaceNav', () => ({
  default: ({
    items,
    activeWorkspace,
    onSelect,
  }: {
    items: Array<{ key: string; label: string }>
    activeWorkspace: string
    onSelect: (value: string) => void
  }) => (
    <nav aria-label="Primary navigation">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-current={item.key === activeWorkspace ? 'page' : undefined}
          onClick={() => onSelect(item.key)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  ),
}))

vi.mock('./components/dashboard/HeroControlCard', () => ({
  default: ({
    onOpenAdvisor,
  }: {
    onOpenAdvisor?: () => void
  }) => (
    <div>
      <div>HeroControlCard</div>
      <button type="button" onClick={onOpenAdvisor}>Open advisor lane</button>
    </div>
  ),
}))
vi.mock('./components/dashboard/LiveMetricStrip', () => ({ default: () => <div>LiveMetricStrip</div> }))
vi.mock('./components/dashboard/AlertRail', () => ({ default: () => <div>AlertRail</div> }))
vi.mock('./components/dashboard/DecisionSnapshotGrid', () => ({ default: () => <div>DecisionSnapshotGrid</div> }))
vi.mock('./components/dashboard/TodayBoard', () => ({ default: () => <div>TodayBoard</div> }))
vi.mock('./components/ControlPanel', () => ({ default: () => <div>ControlPanel</div> }))
vi.mock('./components/CropDetails', () => ({ default: () => <div>CropDetails</div> }))
vi.mock('./components/advisor/AdvisorTabs', () => ({
  default: ({
    initialTab,
    initialCorrectionToolOpen,
  }: {
    initialTab?: string
    initialCorrectionToolOpen?: boolean
  }) => (
    <div>
      <div>AdvisorTabs</div>
      <div data-testid="advisor-initial-tab">{initialTab ?? 'missing'}</div>
      <div data-testid="advisor-correction-open">{String(Boolean(initialCorrectionToolOpen))}</div>
    </div>
  ),
}))
vi.mock('./components/phyto/AskSearchPage', () => ({
  default: ({
    activePanel,
    onOpenSearch,
  }: {
    activePanel?: string
    onOpenSearch?: (request?: { query?: string }) => void
  }) => (
    <div>
      <div>{`AskSearchPage:${activePanel ?? 'missing'}`}</div>
      <button type="button" onClick={() => onOpenSearch?.({ query: 'powdery mildew rotation' })}>Find materials inline</button>
    </div>
  ),
}))
vi.mock('./components/phyto/PageSectionTabs', () => ({
  default: ({
    tabs,
    activeId,
    onSelect,
  }: {
    tabs?: Array<{ id: string }>
    activeId?: string
    onSelect?: (tabId: string) => void
  }) => (
    <div>
      <div data-testid="page-section-active">{activeId ?? 'missing'}</div>
      {tabs?.map((tab) => (
        <button key={tab.id} type="button" onClick={() => onSelect?.(tab.id)}>
          {`Tab:${tab.id}`}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('./components/status/ConfidenceBadge', () => ({ default: () => <div>ConfidenceBadge</div> }))
vi.mock('./features/advisor/AdvisorPanelFallback', () => ({ default: () => <div>AdvisorPanelFallback</div> }))
vi.mock('./features/common/LoadingSkeleton', () => ({ default: ({ title }: { title?: string }) => <div>{title ?? 'LoadingSkeleton'}</div> }))
vi.mock('./components/AiAdvisor', () => ({ default: () => <div>AiAdvisor</div> }))
vi.mock('./components/Charts', () => ({ default: () => <div>Charts</div> }))
vi.mock('./components/ModelAnalytics', () => ({ default: () => <div>ModelAnalytics</div> }))
vi.mock('./components/ForecastPanel', () => ({ default: () => <div>ForecastPanel</div> }))
vi.mock('./components/ConsultingReport', () => ({ default: () => <div>ConsultingReport</div> }))
vi.mock('./components/SmartGrowSurfacePanel', () => ({
  default: ({
    onOpenSurface,
  }: {
    onOpenSurface?: (surfaceKey: 'pesticide' | 'nutrient' | 'nutrient_correction') => void
  }) => (
    <div>
      <div>SmartGrowSurfacePanel</div>
      <button type="button" onClick={() => onOpenSurface?.('nutrient_correction')}>Open nutrient correction</button>
    </div>
  ),
}))
vi.mock('./components/WeatherOutlookPanel', () => ({ default: () => <div>WeatherOutlookPanel</div> }))
vi.mock('./components/ProducePricesPanel', () => ({ default: () => <div>ProducePricesPanel</div> }))
vi.mock('./components/alerts/AlertsCommandCenter', () => ({
  default: ({ activePanel }: { activePanel?: string }) => <div>{`AlertsCommandCenter:${activePanel ?? 'missing'}`}</div>,
}))
vi.mock('./components/resources/ResourcesCommandCenter', () => ({
  default: ({ activePanel }: { activePanel?: string }) => <div>{`ResourcesCommandCenter:${activePanel ?? 'missing'}`}</div>,
}))
vi.mock('./components/RTROptimizerPanel', () => ({ default: () => <div>RTROptimizerPanel</div> }))
vi.mock('./features/assistant/AssistantDrawer', () => ({
  default: ({
    open,
    activePanel,
    onSelectPanel,
    onOpenSearch,
  }: {
    open: boolean
    activePanel?: string
    onSelectPanel?: (panelId: string) => void
    onOpenSearch?: (request?: { query?: string }) => void
  }) => (
    open ? (
      <div>
        <div>{`AssistantDrawer:${activePanel ?? 'missing'}`}</div>
        <button type="button" onClick={() => onSelectPanel?.('assistant-history')}>Drawer history</button>
        <button type="button" onClick={() => onOpenSearch?.({ query: 'powdery mildew rotation' })}>Drawer search</button>
      </div>
    ) : null
  ),
}))
vi.mock('./features/assistant/AssistantFab', () => ({
  default: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" onClick={onClick}>Open assistant fab</button>
  ),
}))

import App from './App'

function renderApp(initialPath = '/overview') {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')

  render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </LocaleProvider>,
  )
}

describe('App routed shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders the direct route entry without falling back to the giant overview stack', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()
    expect(screen.getByText('AskSearchPage:assistant-chat')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('button', { name: 'Open assistant fab' })).toBeNull()
  })

  it('navigates between routed pages from the sidebar', async () => {
    renderApp('/overview')

    expect(await screen.findByRole('heading', { name: 'Today operations' })).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Today Operations')
    expect(screen.getByRole('button', { name: 'Open assistant fab' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Control' }))

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Environment Control')
    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('page')
  })

  it('opens the assistant drawer from the topbar without leaving the current page', async () => {
    renderApp('/overview')

    expect(await screen.findByRole('heading', { name: 'Today operations' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle assistant' }))

    expect(await screen.findByText('AssistantDrawer:assistant-chat')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Today operations' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe('page')
  })

  it('opens the assistant drawer from the floating button on non-assistant routes', async () => {
    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Environment Control')

    fireEvent.click(screen.getByRole('button', { name: 'Open assistant fab' }))

    expect(await screen.findByText('AssistantDrawer:assistant-chat')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Environment Control')
  })

  it('keeps resources and alerts as dedicated pages instead of overview fallbacks', async () => {
    renderApp('/resources')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Resources')
    expect(await screen.findByText('ResourcesCommandCenter:resources-stock')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Alerts' }))

    expect(await screen.findByText('AlertsCommandCenter:alerts-priority')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Alerts')
    expect(screen.getByRole('button', { name: 'Alerts' }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps crop-work as a dedicated page instead of assembling it inline in App', async () => {
    renderApp('/crop-work')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Crop Work')
    expect(await screen.findByText('CropDetails')).toBeTruthy()
    expect(await screen.findByText('TodayBoard')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Crop Work' }).getAttribute('aria-current')).toBe('page')
  })

  it.each([
    ['/ask#ask-chat', 'AskSearchPage:assistant-chat'],
    ['/ask#ask-search', 'AskSearchPage:assistant-search'],
    ['/ask#ask-history', 'AskSearchPage:assistant-history'],
    ['/assistant#ask-search', 'AskSearchPage:assistant-search'],
  ])('keeps legacy assistant hash compatibility for %s', async (path, expectedPanel) => {
    renderApp(path)

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()
    expect(await screen.findByText(expectedPanel)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe('page')
  })

  it.each([
    ['/overview/legacy', 'Today Operations'],
    ['/control/legacy', 'Environment Control'],
    ['/rtr', 'Environment Control'],
    ['/resources/legacy', 'Resources'],
    ['/alerts/legacy', 'Alerts'],
  ])('redirects %s to the canonical routed page', async (path, heading) => {
    renderApp(path)

    expect(screen.getByTestId('topbar-title').textContent).toBe(heading)
  })

  it('redirects nutrient into the resources page with the nutrient segment selected', async () => {
    renderApp('/nutrient#nutrient-tool')

    expect(await screen.findByRole('heading', { name: 'Resources' })).toBeTruthy()
    expect(await screen.findByText('ResourcesCommandCenter:resources-stock')).toBeTruthy()
    expect(screen.getByTestId('page-section-active').textContent).toBe('resources-nutrient')
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Resources' }).getAttribute('aria-current')).toBe('page')
  })

  it('redirects harvest into the crop-work page and keeps the harvest segment selected', async () => {
    renderApp('/harvest#harvest-market')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Crop Work')
    expect(await screen.findByText('TodayBoard')).toBeTruthy()
    expect(screen.getByTestId('page-section-active').textContent).toBe('crop-work-harvest')
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Crop Work' }).getAttribute('aria-current')).toBe('page')
  })

  it('redirects protection into the alerts page with the warning segment selected', async () => {
    renderApp('/protection#protection-check')

    expect(await screen.findByRole('heading', { name: 'Alerts' })).toBeTruthy()
    expect(await screen.findByText('AlertsCommandCenter:alerts-stream')).toBeTruthy()
    expect(screen.getByTestId('page-section-active').textContent).toBe('alerts-warning')
    expect(screen.getByRole('button', { name: 'Alerts' }).getAttribute('aria-current')).toBe('page')
  })

  it('opens the control strategy segment when overview requests the environment lane', async () => {
    renderApp('/overview')

    expect(await screen.findByRole('heading', { name: 'Today operations' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open advisor lane' }))

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Environment Control')
    expect(screen.getByTestId('page-section-active').textContent).toBe('control-strategy')
    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps nutrient correction tool intent when assistant opens the nutrient surface', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open nutrient correction' }))

    expect(await screen.findByRole('heading', { name: 'Resources' })).toBeTruthy()
    expect(await screen.findByText('ResourcesCommandCenter:resources-stock')).toBeTruthy()
    expect(screen.getByTestId('page-section-active').textContent).toBe('resources-nutrient')
    expect(screen.getByRole('button', { name: 'Resources' }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps assistant flows inline inside the assistant route', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()
    expect(screen.getByText('AskSearchPage:assistant-chat')).toBeTruthy()
    expect(screen.getByTestId('page-section-active').textContent).toBe('assistant-chat')

    fireEvent.click(screen.getByRole('button', { name: 'Tab:assistant-search' }))
    expect(await screen.findByText('AskSearchPage:assistant-search')).toBeTruthy()
    expect(screen.getByTestId('page-section-active').textContent).toBe('assistant-search')

    fireEvent.click(screen.getByRole('button', { name: 'Tab:assistant-history' }))
    expect(await screen.findByText('AskSearchPage:assistant-history')).toBeTruthy()
    expect(screen.getByTestId('page-section-active').textContent).toBe('assistant-history')
  })

  it('can seed the assistant drawer search even from the hidden assistant route', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Find materials inline' }))

    expect(await screen.findByText('AssistantDrawer:assistant-search')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Assistant' })).toBeTruthy()
  })
})
