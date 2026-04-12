import { useState, type ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from './i18n/LocaleProvider'
import { LOCALE_STORAGE_KEY } from './i18n/locale'
import type { MetricHistoryPoint } from './types'
import { deriveSourceSinkBalance } from './utils/derivedRuntimeMetrics'

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
  metricHistory: [] as MetricHistoryPoint[],
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
  advisorUpdatedAt: null,
  analyzeData: vi.fn(),
  setActiveCrop: vi.fn(),
}

const cucumberRtrOptimizerState = {
  stateResponse: {
    canonical_state: {
      growth: {
        predicted_node_rate_day: 0.73,
      },
    },
  },
  optimizeResponse: null,
  scenarioResponse: null,
  sensitivityResponse: null,
  targetNodeDevelopmentPerDay: 0.73,
  setTargetNodeDevelopmentPerDay: vi.fn(),
  optimizationMode: 'balanced',
  setOptimizationMode: vi.fn(),
  customScenario: null,
  setCustomScenario: vi.fn(),
  includeEnergyCost: true,
  setIncludeEnergyCost: vi.fn(),
  includeCoolingCost: true,
  setIncludeCoolingCost: vi.fn(),
  includeLaborCost: true,
  setIncludeLaborCost: vi.fn(),
  telemetryOptimizationBlocked: false,
  loading: false,
  loadingState: false,
  loadingOptimize: false,
  error: null,
  refreshState: vi.fn(),
  refreshOptimization: vi.fn(),
}

const tomatoRtrOptimizerState = {
  ...cucumberRtrOptimizerState,
  stateResponse: {
    canonical_state: {
      growth: {
        predicted_node_rate_day: 1.26,
      },
    },
  },
  targetNodeDevelopmentPerDay: 1.26,
  optimizationMode: 'yield_priority',
}

vi.mock('./hooks/useGreenhouse', () => ({
  useGreenhouse: () => {
    const [selectedCrop, setSelectedCrop] = useState<typeof greenhouseState.selectedCrop>(greenhouseState.selectedCrop)
    return {
      ...greenhouseState,
      selectedCrop,
      setSelectedCrop,
    }
  },
}))

vi.mock('./context/AreaUnitContext', () => ({
  useAreaUnit: () => ({
    areaByCrop: {
      Tomato: { actualAreaM2: null, actualAreaPyeong: null, source: 'default' },
      Cucumber: { actualAreaM2: null, actualAreaPyeong: null, source: 'default' },
    },
    setActualAreaM2: vi.fn(),
    setActualAreaPyeong: vi.fn(),
    syncAreaMeta: vi.fn(),
  }),
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

vi.mock('./hooks/useOverviewSignalTrends', () => ({
  useOverviewSignalTrends: () => ({
    signals: {
      status: 'success',
      crop: 'cucumber',
      greenhouse_id: 'cucumber',
      window_hours: 72,
      irradiance: {
        source: { provider: 'Open-Meteo' },
        unit: 'W/m²',
        points: [
          { time: '2026-04-09T08:00:00+09:00', shortwave_radiation_w_m2: 280 },
          { time: '2026-04-09T09:00:00+09:00', shortwave_radiation_w_m2: 410 },
        ],
      },
      source_sink: {
        source: { provider: 'Model runtime snapshots' },
        unit: 'index',
        status: 'ready',
        points: [
          { time: '2026-04-09T08:00:00+09:00', source_sink_balance: 0.21, source_capacity: 12.4, sink_demand: 8.2 },
          { time: '2026-04-09T09:00:00+09:00', source_sink_balance: 0.26, source_capacity: 12.9, sink_demand: 7.6 },
        ],
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
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
        Tomato: {
          strategyLabel: 'Yield lane',
          optimizer: {
            enabled: true,
            default_mode: 'yield_priority',
          },
        },
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('./hooks/useRtrOptimizer', () => ({
  useRtrOptimizer: ({ crop }: { crop: 'Cucumber' | 'Tomato' }) => (
    crop === 'Tomato' ? tomatoRtrOptimizerState : cucumberRtrOptimizerState
  ),
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
    selectedCrop,
    onCropChange,
    onAssistantToggle,
    onOpenSettings,
  }: {
    pageTitle: string
    selectedCrop?: 'Cucumber' | 'Tomato'
    onCropChange?: (crop: 'Cucumber' | 'Tomato') => void
    onAssistantToggle?: () => void
    onOpenSettings?: () => void
  }) => (
    <div>
      <div data-testid="topbar-title">{pageTitle}</div>
      <button type="button" aria-pressed={selectedCrop === 'Cucumber'} onClick={() => onCropChange?.('Cucumber')}>Cucumber</button>
      <button type="button" aria-pressed={selectedCrop === 'Tomato'} onClick={() => onCropChange?.('Tomato')}>Tomato</button>
      <button type="button" onClick={onAssistantToggle}>Toggle assistant</button>
      <button type="button" onClick={onOpenSettings}>Open settings</button>
    </div>
  ),
}))

vi.mock('./components/shell/WorkspaceNav', () => ({
  default: ({
    items,
    activeWorkspace,
    activeActionId,
    onSelect,
    onSelectAction,
  }: {
    items: Array<{ key: string; label: string; actions?: Array<{ id: string; label: string }> }>
    activeWorkspace: string
    activeActionId?: string
    onSelect: (value: string) => void
    onSelectAction?: (workspace: string, actionId: string) => void
  }) => (
    <nav aria-label="Primary navigation">
      {items.map((item) => (
        <div key={item.key}>
          <button
            type="button"
            aria-current={item.key === activeWorkspace ? 'page' : undefined}
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </button>
          {item.key === activeWorkspace
            ? item.actions?.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  aria-current={activeActionId === action.id ? 'step' : undefined}
                  onClick={() => onSelectAction?.(item.key, action.id)}
                >
                  {`Action:${action.id}`}
                </button>
              ))
            : null}
        </div>
      ))}
    </nav>
  ),
}))

vi.mock('./components/dashboard/HeroControlCard', () => ({
  default: ({
    onOpenAdvisor,
    sourceSinkBalance,
    canopyAssimilation,
    lai,
  }: {
    onOpenAdvisor?: () => void
    sourceSinkBalance?: number | null
    canopyAssimilation?: number | null
    lai?: number | null
  }) => (
    <div>
      <div>HeroControlCard</div>
      <div data-testid="hero-source-sink">{String(sourceSinkBalance ?? '')}</div>
      <div data-testid="hero-canopy">{String(canopyAssimilation ?? '')}</div>
      <div data-testid="hero-lai">{String(lai ?? '')}</div>
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
vi.mock('./components/Charts', () => ({ default: () => <div>Charts</div> }))
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
vi.mock('./components/dashboard/OverviewSignalTrendCard', () => ({
  default: ({
    liveSourceSinkSeries,
  }: {
    liveSourceSinkSeries?: Array<{ timestamp: number; value: number }>
  }) => (
    <div data-testid="overview-live-source-sink-series">
      {JSON.stringify(liveSourceSinkSeries ?? [])}
    </div>
  ),
}))
vi.mock('./components/alerts/AlertsCommandCenter', () => ({
  default: ({ activePanel }: { activePanel?: string }) => <div>{`AlertsCommandCenter:${activePanel ?? 'missing'}`}</div>,
}))
vi.mock('./components/resources/ResourcesCommandCenter', () => ({
  default: ({ activePanel }: { activePanel?: string }) => <div>{`ResourcesCommandCenter:${activePanel ?? 'missing'}`}</div>,
}))
vi.mock('./components/RTROptimizerPanel', () => ({
  default: ({
    optimizerState,
    uiState,
  }: {
    optimizerState?: {
      targetNodeDevelopmentPerDay?: number | null
      optimizationMode?: string
    }
    uiState?: {
      targetNodeInputValue?: string
      setTargetNodeInputValue?: (value: string) => void
    }
  }) => (
    <div>
      <div>RTROptimizerPanel</div>
      <div data-testid="rtr-optimizer-state">{`${optimizerState?.targetNodeDevelopmentPerDay ?? 'missing'}|${optimizerState?.optimizationMode ?? 'missing'}`}</div>
      <div data-testid="rtr-ui-state">{uiState?.targetNodeInputValue ?? ''}</div>
      <button
        type="button"
        onClick={() => uiState?.setTargetNodeInputValue?.('0.81')}
      >
        Persist RTR draft
      </button>
    </div>
  ),
}))
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

  it('prefers live overview metrics over stale advisor snapshot values', async () => {
    const originalSnapshot = advisorState.aiModelRuntime.state_snapshot
    advisorState.aiModelRuntime.state_snapshot = {
      ...originalSnapshot,
      source_sink_balance: 0.91,
      canopy_net_assimilation_umol_m2_s: 9.9,
      lai: 1.5,
    }

    try {
      renderApp('/overview')
      await waitForElementToBeRemoved(() => screen.queryByText('화면을 불러오는 중입니다.'), { timeout: 5000 })

      const expectedSourceSinkBalance = deriveSourceSinkBalance({
        crop: 'Cucumber',
        currentData: greenhouseState.currentData as Parameters<typeof deriveSourceSinkBalance>[0]['currentData'],
        metrics: greenhouseState.modelMetrics as Parameters<typeof deriveSourceSinkBalance>[0]['metrics'],
      })

      expect(await screen.findByTestId('hero-source-sink', {}, { timeout: 5000 })).toBeTruthy()
      expect(screen.getByTestId('hero-source-sink').textContent).toBe(String(expectedSourceSinkBalance))
      expect(screen.getByTestId('hero-canopy').textContent).toBe(String(greenhouseState.currentData.photosynthesis))
      expect(screen.getByTestId('hero-lai').textContent).toBe(String(greenhouseState.modelMetrics.growth.lai))
    } finally {
      advisorState.aiModelRuntime.state_snapshot = originalSnapshot
    }
  })

  it('uses simulation timestamps for the live source-sink overlay series', async () => {
    const originalMetricHistory = greenhouseState.metricHistory
    const simulationTimestamp = Date.parse('2021-02-23T08:00:00Z')
    const wallClockTimestamp = Date.parse('2026-04-09T09:15:00+09:00')
    greenhouseState.metricHistory = [
      {
        timestamp: simulationTimestamp,
        receivedAtTimestamp: wallClockTimestamp,
        lai: greenhouseState.modelMetrics.growth.lai,
        biomass: 180,
        growthRate: 4.2,
        sourceSinkBalance: 0.37,
        predictedWeeklyYield: greenhouseState.modelMetrics.yield.predictedWeekly,
        harvestableFruits: 24,
        energyConsumption: greenhouseState.modelMetrics.energy.consumption,
        energyLoadKw: greenhouseState.modelMetrics.energy.consumption,
        energyEfficiency: greenhouseState.modelMetrics.energy.efficiency,
      },
    ]

    try {
      renderApp('/overview')
      await waitFor(() => expect(screen.getByTestId('overview-live-source-sink-series')).toBeTruthy())

      const liveSeries = JSON.parse(screen.getByTestId('overview-live-source-sink-series').textContent ?? '[]') as Array<{ timestamp: number; value: number }>
      expect(liveSeries.length).toBeGreaterThan(0)
      expect(liveSeries[liveSeries.length - 1]?.timestamp).toBe(simulationTimestamp)
      expect(liveSeries.some((point) => point.timestamp === wallClockTimestamp)).toBe(false)
    } finally {
      greenhouseState.metricHistory = originalMetricHistory
    }
  })

  it('navigates between routed pages from the sidebar', async () => {
    renderApp('/overview')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Today Operations')
    expect(screen.getByRole('button', { name: 'Open assistant fab' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Control' }))

    await waitFor(() => {
      expect(screen.getByTestId('topbar-title').textContent).toBe('Control Solutions')
    })
    expect(screen.getByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('page')
  }, 15000)

  it('keeps RTR state outside route-local control pages', async () => {
    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('rtr-optimizer-state').textContent).toBe('0.73|balanced')

    fireEvent.click(screen.getByRole('button', { name: 'Trend' }))
    await waitFor(() => {
      expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Control' }))
    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('rtr-optimizer-state').textContent).toBe('0.73|balanced')
  })

  it('keeps RTR draft input state across section transitions', async () => {
    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Persist RTR draft' }))
    expect(screen.getByTestId('rtr-ui-state').textContent).toBe('0.81')

    fireEvent.click(screen.getByRole('button', { name: 'Trend' }))
    await waitFor(() => {
      expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Control' }))
    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('rtr-ui-state').textContent).toBe('0.81')
  })

  it('restores RTR draft ui state from localStorage on first render', async () => {
    window.localStorage.setItem('smartgrow-rtr-ui-state-v1', JSON.stringify({
      Cucumber: {
        customScenarioDraft: {
          label: '',
          dayHeatingMinTempC: '',
          nightHeatingMinTempC: '',
          dayCoolingTargetC: '',
          nightCoolingTargetC: '',
          ventBiasC: '',
          screenBiasPct: '',
          circulationFanPct: '',
          co2TargetPpm: '',
        },
        targetNodeInputValue: '0.92',
        isTargetNodeInputActive: true,
      },
      Tomato: {
        customScenarioDraft: {
          label: '',
          dayHeatingMinTempC: '',
          nightHeatingMinTempC: '',
          dayCoolingTargetC: '',
          nightCoolingTargetC: '',
          ventBiasC: '',
          screenBiasPct: '',
          circulationFanPct: '',
          co2TargetPpm: '',
        },
        targetNodeInputValue: '',
        isTargetNodeInputActive: false,
      },
    }))

    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('rtr-ui-state').textContent).toBe('0.92')
  })

  it('restores committed RTR state when switching crops back and forth', async () => {
    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('rtr-optimizer-state').textContent).toBe('0.73|balanced')

    fireEvent.click(screen.getByRole('button', { name: 'Tomato' }))
    expect(screen.getByTestId('rtr-optimizer-state').textContent).toBe('1.26|yield_priority')

    fireEvent.click(screen.getByRole('button', { name: 'Cucumber' }))
    expect(screen.getByTestId('rtr-optimizer-state').textContent).toBe('0.73|balanced')
  })

  it('shows section actions on sidebar interaction and applies the selected section action', async () => {
    renderApp('/overview')

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    fireEvent.click(screen.getByRole('button', { name: 'Action:overview-dashboard' }))

    expect(await screen.findByText('Charts')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps control section actions inline and leaves the recommended control surface visible', async () => {
    renderApp('/control')

    expect(screen.getByText('AlertRail')).toBeTruthy()
    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByText('ControlPanel')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Action:control-devices' }))

    expect(screen.queryByText('RTROptimizerPanel')).toBeNull()
    expect(screen.getByText('AlertRail')).toBeTruthy()
    expect(screen.getByText('ControlPanel')).toBeTruthy()
    expect(screen.queryByTestId('page-section-active')).toBeNull()
    expect(screen.getByRole('button', { name: 'Action:control-devices' }).getAttribute('aria-current')).toBe('step')

    fireEvent.click(screen.getByRole('button', { name: 'Action:control-strategy' }))

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByText('AlertRail')).toBeTruthy()
    expect(screen.getByText('ControlPanel')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Action:control-strategy' }).getAttribute('aria-current')).toBe('step')
    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('page')
  })

  it('opens the assistant drawer from the topbar without leaving the current page', async () => {
    renderApp('/overview')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Today Operations')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle assistant' }))

    expect(await screen.findByText('AssistantDrawer:assistant-chat')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Today Operations')
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe('page')
  })

  it('opens the assistant drawer from the floating button on non-assistant routes', async () => {
    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Control Solutions')

    fireEvent.click(screen.getByRole('button', { name: 'Open assistant fab' }))

    expect(await screen.findByText('AssistantDrawer:assistant-chat')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Control Solutions')
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

  it('keeps trend as a dedicated page separated from control', async () => {
    renderApp('/trend')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')
    expect(await screen.findByText('WeatherOutlookPanel')).toBeTruthy()
    expect(await screen.findByText('DecisionSnapshotGrid')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trend' }).getAttribute('aria-current')).toBe('page')
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
    ['/ask#ask-history', 'AskSearchPage:assistant-search'],
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
    ['/control/legacy', 'Control Solutions'],
    ['/trend/legacy', 'Trend'],
    ['/rtr', 'Control Solutions'],
    ['/resources/legacy', 'Resources'],
    ['/alerts/legacy', 'Alerts'],
  ])('redirects %s to the canonical routed page', async (path, heading) => {
    renderApp(path)

    expect(screen.getByTestId('topbar-title').textContent).toBe(heading)
  })

  it('redirects nutrient into the resources page with the nutrient segment selected', async () => {
    renderApp('/nutrient#nutrient-tool')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Resources')
    expect(await screen.findByText('ResourcesCommandCenter:resources-stock')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Resources' }).getAttribute('aria-current')).toBe('page')
  })

  it('redirects harvest into the crop-work page and keeps the harvest segment selected', async () => {
    renderApp('/harvest#harvest-market')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Crop Work')
    expect(await screen.findByText('TodayBoard')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Crop Work' }).getAttribute('aria-current')).toBe('page')
  })

  it('redirects protection into the alerts page with the warning segment selected', async () => {
    renderApp('/protection#protection-check')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Alerts')
    expect(await screen.findByText('AlertsCommandCenter:alerts-stream')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Alerts' }).getAttribute('aria-current')).toBe('page')
  })

  it('opens the control strategy segment when overview requests the environment lane', async () => {
    renderApp('/overview')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Today Operations')

    fireEvent.click(screen.getByRole('button', { name: 'Open advisor lane' }))

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Control Solutions')
    expect(screen.queryByTestId('page-section-active')).toBeNull()
    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps nutrient correction tool intent when assistant opens the nutrient surface', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open nutrient correction' }))

    expect(screen.getByTestId('topbar-title').textContent).toBe('Resources')
    expect(await screen.findByText('ResourcesCommandCenter:resources-stock')).toBeTruthy()
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
  })

  it('keeps assistant search inline even from the hidden assistant route', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Find materials inline' }))

    expect(await screen.findByText('AskSearchPage:assistant-search')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Assistant' })).toBeTruthy()
    expect(screen.queryByText('AssistantDrawer:assistant-search')).toBeNull()
  })

  it('keeps the assistant route inline when the topbar toggle is pressed on /assistant', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle assistant' }))

    expect(await screen.findByText('AskSearchPage:assistant-chat')).toBeTruthy()
    expect(screen.getByTestId('page-section-active').textContent).toBe('assistant-chat')
    expect(screen.queryByText('AssistantDrawer:assistant-chat')).toBeNull()
  })

  it('closes the assistant drawer before navigating to settings', async () => {
    renderApp('/overview')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Today Operations')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle assistant' }))
    expect(await screen.findByText('AssistantDrawer:assistant-chat')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.queryByText('AssistantDrawer:assistant-chat')).toBeNull()
  })
})
