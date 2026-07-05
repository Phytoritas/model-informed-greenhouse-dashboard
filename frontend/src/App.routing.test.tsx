import { useState, type ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from './i18n/LocaleProvider'
import { LOCALE_STORAGE_KEY } from './i18n/locale'
import type { ModelRuntimeConstraintViolation } from './hooks/useSmartGrowAdvisor'
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
      violated_constraints: [] as ModelRuntimeConstraintViolation[],
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

const weatherOutlookState = {
  weather: {
    current: {
      temperature_c: 17.8,
      weather_label: 'Clear',
    },
  } as unknown,
  loading: false,
  error: null as string | null,
}

const producePricesState = {
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
  } as unknown,
  loading: false,
  error: null as string | null,
}

const overviewSignalsState = {
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
  } as unknown,
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
}

vi.mock('./hooks/useWeatherOutlook', () => ({
  useWeatherOutlook: () => weatherOutlookState,
}))

vi.mock('./hooks/useProducePrices', () => ({
  useProducePrices: () => producePricesState,
}))

vi.mock('./hooks/useOverviewSignalTrends', () => ({
  useOverviewSignalTrends: () => overviewSignalsState,
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

vi.mock('./components/shell/WorkspaceTopNav', () => ({
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
  }) => {
    const activeItem = items.find((item) => item.key === activeWorkspace)

    return (
      <div>
        {items.length > 0 ? (
          <nav aria-label="Category subtab navigation">
            {items.map((item) => (
              <div key={item.key}>
                <button
                  type="button"
                  aria-current={item.key === activeWorkspace ? 'step' : undefined}
                  onClick={() => onSelect(item.key)}
                >
                  {item.label}
                </button>
              </div>
            ))}
          </nav>
        ) : null}
        {activeItem?.actions?.length ? (
          <nav aria-label="Panel action navigation">
            {activeItem.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                aria-pressed={activeActionId === action.id}
                onClick={() => onSelectAction?.(activeItem.key, action.id)}
              >
                {`Action:${action.id}`}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    )
  },
}))

vi.mock('./components/dashboard/HeroControlCard', () => ({
  default: ({
    onOpenAdvisor,
    sourceSinkBalance,
    canopyAssimilation,
    lai,
    importantIssue,
  }: {
    onOpenAdvisor?: () => void
    sourceSinkBalance?: number | null
    canopyAssimilation?: number | null
    lai?: number | null
    importantIssue?: string | null
  }) => (
    <div>
      <div>HeroControlCard</div>
      <div data-testid="hero-source-sink">{String(sourceSinkBalance ?? '')}</div>
      <div data-testid="hero-canopy">{String(canopyAssimilation ?? '')}</div>
      <div data-testid="hero-lai">{String(lai ?? '')}</div>
      <div data-testid="hero-important-issue">{importantIssue ?? ''}</div>
      <button type="button" onClick={onOpenAdvisor}>Open advisor lane</button>
    </div>
  ),
}))
vi.mock('./components/dashboard/LiveMetricStrip', () => ({ default: () => <div>LiveMetricStrip</div> }))
vi.mock('./components/dashboard/AlertRail', () => ({
  default: ({
    items,
  }: {
    items?: Array<{ title: string; body: string; auxiliaryText?: string }>
  }) => (
    <div>
      <div>AlertRail</div>
      <div data-testid="alert-rail-items">
        {(items ?? []).map((item) => `${item.title} ${item.body} ${item.auxiliaryText ?? ''}`).join(' | ')}
      </div>
    </div>
  ),
}))
vi.mock('./components/dashboard/DecisionSnapshotGrid', () => ({
  default: ({
    weather,
    weatherLoading,
    producePrices,
    produceLoading,
    overviewSignals,
  }: {
    weather?: unknown
    weatherLoading?: boolean
    producePrices?: unknown
    produceLoading?: boolean
    overviewSignals?: unknown
  }) => (
    <div>
      <div>DecisionSnapshotGrid</div>
      <div data-testid="decision-snapshot-props">
        {`weather:${weather ? 'present' : 'null'} weatherLoading:${String(Boolean(weatherLoading))} produce:${producePrices ? 'present' : 'null'} produceLoading:${String(Boolean(produceLoading))} overview:${overviewSignals ? 'present' : 'null'}`}
      </div>
    </div>
  ),
}))
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
vi.mock('./components/WeatherOutlookPanel', () => ({
  default: ({
    weather,
    loading,
    error,
  }: {
    weather?: unknown
    loading?: boolean
    error?: string | null
  }) => (
    <div>
      <div>WeatherOutlookPanel</div>
      <div data-testid="weather-outlook-props">
        {`weather:${weather ? 'present' : 'null'} loading:${String(Boolean(loading))} error:${error ?? 'none'}`}
      </div>
    </div>
  ),
}))
vi.mock('./components/ProducePricesPanel', () => ({
  default: ({
    prices,
    loading,
    error,
  }: {
    prices?: unknown
    loading?: boolean
    error?: string | null
  }) => (
    <div>
      <div>ProducePricesPanel</div>
      <div data-testid="produce-prices-props">
        {`prices:${prices ? 'present' : 'null'} loading:${String(Boolean(loading))} error:${error ?? 'none'}`}
      </div>
    </div>
  ),
}))
vi.mock('./components/dashboard/WeatherTrendPanel', () => ({
  default: ({
    weather,
    loading,
    error,
  }: {
    weather?: unknown
    loading?: boolean
    error?: string | null
  }) => (
    <div>
      <div>WeatherTrendPanel</div>
      <div data-testid="weather-trend-props">
        {`weather:${weather ? 'present' : 'null'} loading:${String(Boolean(loading))} error:${error ?? 'none'}`}
      </div>
    </div>
  ),
}))
vi.mock('./components/dashboard/ModelScenarioWorkbench', () => ({ default: () => <div>ModelScenarioWorkbench</div> }))
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

function renderApp(initialPath = '/overview', locale = 'en') {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)

  render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </LocaleProvider>,
  )
}

function jsonResponse(payload: Record<string, unknown>, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    json: async () => payload,
  } as Response
}

function stubSettingsAndRuntimeFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url.includes('/settings')) {
      return jsonResponse({
        settings: {
          price_per_kg: 3200,
          cost_per_kwh: 125,
        },
      })
    }

    if (url.includes('/speed')) {
      return jsonResponse({ status: 'speed-ok', body: init?.body ?? null })
    }

    if (url.includes('/pause')) {
      return jsonResponse({ status: 'pause-ok' })
    }

    if (url.includes('/resume')) {
      return jsonResponse({ status: 'resume-ok' })
    }

    return jsonResponse({ status: 'success' })
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('App routed shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    weatherOutlookState.weather = {
      current: {
        temperature_c: 17.8,
        weather_label: 'Clear',
      },
    }
    weatherOutlookState.loading = false
    weatherOutlookState.error = null
    producePricesState.prices = {
      source: {
        fetched_at: '2026-04-09T09:00:00Z',
      },
      items: [
        {
          display_name: 'Cucumber',
          current_price_krw: 12400,
        },
      ],
    }
    producePricesState.loading = false
    producePricesState.error = null
    overviewSignalsState.signals = {
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
    }
    overviewSignalsState.loading = false
    overviewSignalsState.error = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the direct route entry without falling back to the giant overview stack', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()
    expect(screen.getByText('AskSearchPage:assistant-chat')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('link', { name: 'KNOWLEDGE' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Assistant' }).getAttribute('aria-current')).toBe('step')
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
      await waitForElementToBeRemoved(() => screen.queryByText('화면을 불러오는 중입니다.'), { timeout: 15000 })

      const expectedSourceSinkBalance = deriveSourceSinkBalance({
        crop: 'Cucumber',
        currentData: greenhouseState.currentData as Parameters<typeof deriveSourceSinkBalance>[0]['currentData'],
        metrics: greenhouseState.modelMetrics as Parameters<typeof deriveSourceSinkBalance>[0]['metrics'],
      })

      expect(await screen.findByTestId('hero-source-sink', {}, { timeout: 15000 })).toBeTruthy()
      expect(screen.getByTestId('hero-source-sink').textContent).toBe(String(expectedSourceSinkBalance))
      expect(screen.getByTestId('hero-canopy').textContent).toBe(String(greenhouseState.currentData.photosynthesis))
      expect(screen.getByTestId('hero-lai').textContent).toBe(String(greenhouseState.modelMetrics.growth.lai))
    } finally {
      advisorState.aiModelRuntime.state_snapshot = originalSnapshot
    }
  }, 20000)

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
      renderApp('/overview#overview-dashboard')
      await waitFor(() => expect(screen.getByTestId('overview-live-source-sink-series')).toBeTruthy())

      const liveSeries = JSON.parse(screen.getByTestId('overview-live-source-sink-series').textContent ?? '[]') as Array<{ timestamp: number; value: number }>
      expect(liveSeries.length).toBeGreaterThan(0)
      expect(liveSeries[liveSeries.length - 1]?.timestamp).toBe(simulationTimestamp)
      expect(liveSeries.some((point) => point.timestamp === wallClockTimestamp)).toBe(false)
    } finally {
      greenhouseState.metricHistory = originalMetricHistory
    }
  })

  it('renders overview as a standalone reference landing surface', async () => {
    renderApp('/overview')

    expect(screen.queryByTestId('app-topbar')).toBeNull()
    expect(screen.queryByTestId('app-sidebar')).toBeNull()
    expect(screen.queryByTestId('topbar-title')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open assistant fab' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'PhytoSync global navigation' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('href')).toBe('/control')
    expect(screen.getByRole('link', { name: 'View Dashboard' }).getAttribute('href')).toBe('/control')
    expect(screen.getByRole('button', { name: 'Ask Assistant' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'AI decision platform for smart greenhouses.' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ask Assistant' }))
    expect(await screen.findByText('AssistantDrawer:assistant-chat')).toBeTruthy()
  })

  it('redirects the root route into the standalone overview landing', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'AI decision platform for smart greenhouses.' })).toBeTruthy()
    expect(screen.queryByTestId('app-topbar')).toBeNull()
    expect(screen.queryByTestId('app-sidebar')).toBeNull()
  })

  it('navigates between routed shell pages from the workspace top nav', async () => {
    renderApp('/trend')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')
    expect(screen.getByRole('button', { name: 'Open assistant fab' })).toBeTruthy()

    fireEvent.click(screen.getByRole('link', { name: 'DASHBOARD' }))

    await waitFor(() => {
      expect(screen.getByTestId('topbar-title').textContent).toBe('Control Solutions')
    })
    expect(await screen.findByText('RTROptimizerPanel', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('step')
  }, 15000)

  it('keeps RTR state outside route-local control pages', async () => {
    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('rtr-optimizer-state').textContent).toBe('0.73|balanced')

    fireEvent.click(screen.getByRole('link', { name: 'INSIGHTS' }))
    await waitFor(() => {
      expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')
    })

    fireEvent.click(screen.getByRole('link', { name: 'DASHBOARD' }))
    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByTestId('rtr-optimizer-state').textContent).toBe('0.73|balanced')
  })

  it('keeps RTR draft input state across section transitions', async () => {
    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Persist RTR draft' }))
    expect(screen.getByTestId('rtr-ui-state').textContent).toBe('0.81')

    fireEvent.click(screen.getByRole('link', { name: 'INSIGHTS' }))
    await waitFor(() => {
      expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')
    })

    fireEvent.click(screen.getByRole('link', { name: 'DASHBOARD' }))
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

  it('routes standalone landing navigation to live surfaces without dead hash anchors', async () => {
    renderApp('/overview')

    expect(screen.queryByRole('button', { name: 'Overview' })).toBeNull()
    expect(screen.getByRole('link', { name: 'HOME' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('href')).toBe('/control')
    expect(screen.getByRole('link', { name: 'INSIGHTS' }).getAttribute('href')).toBe('/trend')
    expect(screen.getByRole('link', { name: 'SCENARIOS' }).getAttribute('href')).toBe('/scenarios')
    expect(screen.getByRole('link', { name: 'KNOWLEDGE' }).getAttribute('href')).toBe('/assistant')
    expect(screen.getByRole('link', { name: 'CONTACT' }).getAttribute('href')).toBe('/contact')
    expect(screen.getByRole('region', { name: 'AI decision platform for smart greenhouses.' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Live decision metrics' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Actions worth checking today' })).toBeTruthy()
  })

  it('verify_src001_s0002_r001_a01 renders the same global navigation on routed workspace screens', async () => {
    renderApp('/control')

    const globalNav = screen.getByRole('navigation', { name: 'PhytoSync global navigation' })
    expect(globalNav.textContent).toContain('HOME')
    expect(globalNav.textContent).toContain('DASHBOARD')
    expect(globalNav.textContent).toContain('INSIGHTS')
    expect(globalNav.textContent).toContain('SCENARIOS')
    expect(globalNav.textContent).toContain('KNOWLEDGE')
    expect(globalNav.textContent).toContain('CONTACT')
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('step')
  })

  it('verify_src001_s0002_r003_a01 keeps only the active parent category subtabs visible', async () => {
    renderApp('/control')

    const categoryNav = screen.getByRole('navigation', { name: 'Category subtab navigation' })
    expect(categoryNav.textContent).toContain('Control')
    expect(categoryNav.textContent).toContain('RTR Optimizer')
    expect(categoryNav.textContent).toContain('Crop Work')
    expect(categoryNav.textContent).toContain('Resources')
    expect(categoryNav.textContent).toContain('Alerts')
    expect(categoryNav.textContent).not.toContain('Trend')
    expect(categoryNav.textContent).not.toContain('Scenario')
    expect(categoryNav.textContent).not.toContain('Assistant')
    expect(categoryNav.textContent).not.toContain('Settings')
  })

  it('verify_src001_s0002_r004_a01 removes the old flat ten-item workspace strip', async () => {
    renderApp('/trend')

    const categoryNav = screen.getByRole('navigation', { name: 'Category subtab navigation' })
    expect(categoryNav.textContent).toBe('Trend')
    expect(categoryNav.textContent).not.toContain('Control')
    expect(categoryNav.textContent).not.toContain('RTR')
    expect(categoryNav.textContent).not.toContain('Resources')
    expect(categoryNav.textContent).not.toContain('Alerts')
    expect(categoryNav.textContent).not.toContain('Assistant')
    expect(screen.getByRole('link', { name: 'INSIGHTS' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Trend' }).getAttribute('aria-current')).toBe('step')
  })

  it('verify_src001_s0002_r006_a01 keeps settings as a header button instead of a subtab', async () => {
    renderApp('/control')

    expect(screen.getByRole('navigation', { name: 'PhytoSync global navigation' }).textContent).not.toContain('Settings')
    expect(screen.getByRole('navigation', { name: 'Category subtab navigation' }).textContent).not.toContain('Settings')

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'PhytoSync global navigation' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Category subtab navigation' })).toBeNull()
  })

  it('verify_src001_s0006_r002_a01 keeps AlertRail off /control while leaving the control surfaces visible', async () => {
    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByText('ControlPanel')).toBeTruthy()
    expect(screen.queryByText('AlertRail')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Action:control-devices' }))

    expect(screen.queryByText('RTROptimizerPanel')).toBeNull()
    expect(screen.getByText('ControlPanel')).toBeTruthy()
    expect(screen.queryByText('AlertRail')).toBeNull()
    expect(screen.queryByTestId('page-section-active')).toBeNull()
    expect(screen.getByRole('button', { name: 'Action:control-devices' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Action:control-strategy' }))

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByText('ControlPanel')).toBeTruthy()
    expect(screen.queryByText('AlertRail')).toBeNull()
    expect(screen.getByRole('button', { name: 'Action:control-strategy' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('step')
  })

  it('renders runtime constraint alerts through friendly copy without raw identifiers', async () => {
    const originalViolations = advisorState.aiModelRuntime.constraint_checks.violated_constraints
    advisorState.aiModelRuntime.constraint_checks.violated_constraints = [{
      code: 'humidity_floor_risk',
      control: 'rh_target',
      severity: 'high',
      message: 'rh_target decrease triggers humidity_floor_risk below floor',
    }, {
      code: 'disease_risk_high',
      control: 'rh_target',
      severity: 'high',
      message: 'Resulting RH exceeds the bounded disease-risk ceiling.',
    }]

    try {
      renderApp('/overview#overview-watch', 'ko')

      expect(await screen.findByText('AlertRail')).toBeTruthy()
      const alertText = screen.getByTestId('alert-rail-items').textContent ?? ''

      expect(alertText).toContain('습도 회복 하한 위험')
      expect(alertText).toContain('습도 목표를 낮추면 상대습도가 회복 하한 아래로 떨어질 수 있어요.')
      expect(alertText).toContain('습도 병해 위험')
      expect(alertText).not.toContain('rh_target')
      expect(alertText).not.toContain('humidity_floor_risk')
      expect(alertText).not.toContain('disease_risk_high')
      expect(alertText).not.toContain('triggers')
      expect(alertText).not.toContain('bounded disease-risk ceiling')
    } finally {
      advisorState.aiModelRuntime.constraint_checks.violated_constraints = originalViolations
    }
  })

  it('keeps unknown runtime constraint codes in auxiliary alert text only', async () => {
    const originalViolations = advisorState.aiModelRuntime.constraint_checks.violated_constraints
    advisorState.aiModelRuntime.constraint_checks.violated_constraints = [{
      code: 'custom_floor_risk',
      control: 'unknown_control',
      severity: 'high',
      message: 'unknown_control triggered custom_floor_risk',
    }]

    try {
      renderApp('/overview#overview-watch', 'ko')

      expect(await screen.findByText('AlertRail')).toBeTruthy()
      const alertText = screen.getByTestId('alert-rail-items').textContent ?? ''

      expect(alertText).toContain('운영 제약 확인 필요')
      expect(alertText).toContain('사전에 없는 운영 제약이 감지되었습니다. 현재 설정을 확인해 주세요.')
      expect(alertText).toContain('원문 코드: unknown_control · custom_floor_risk')
    } finally {
      advisorState.aiModelRuntime.constraint_checks.violated_constraints = originalViolations
    }
  })

  it('uses friendly runtime constraint copy in the overview hero screen-reader issue text', async () => {
    const originalViolations = advisorState.aiModelRuntime.constraint_checks.violated_constraints
    const originalRisks = advisorState.aiDisplay.risks
    advisorState.aiDisplay.risks = []
    advisorState.aiModelRuntime.constraint_checks.violated_constraints = [{
      code: 'humidity_floor_risk',
      control: 'rh_target',
      severity: 'medium',
      message: 'Resulting RH falls below the bounded recovery floor.',
    }]

    try {
      renderApp('/overview', 'ko')

      const heroIssue = await screen.findByTestId('hero-important-issue')
      expect(heroIssue.textContent).toBe('습도 목표를 낮추면 상대습도가 회복 하한 아래로 떨어질 수 있어요. 현재 설정을 확인해 주세요.')
      expect(heroIssue.textContent).not.toContain('humidity_floor_risk')
      expect(heroIssue.textContent).not.toContain('bounded recovery floor')
    } finally {
      advisorState.aiDisplay.risks = originalRisks
      advisorState.aiModelRuntime.constraint_checks.violated_constraints = originalViolations
    }
  })

  it('verify_src001_s0004_r001_a01 moves SimulationRuntimePanel from /control to /settings', async () => {
    stubSettingsAndRuntimeFetch()

    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Live Climate & Controls' })).toBeNull()
    expect(screen.queryByText('Simulation Runtime')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Live Climate & Controls' })).toBeTruthy()
    expect(screen.getByText('Simulation Runtime')).toBeTruthy()
  })

  it('verify_src001_s0004_r002_a01 keeps settings runtime pace presets, pause/resume, and sg-sim-pace persistence working', async () => {
    const fetchMock = stubSettingsAndRuntimeFetch()
    window.localStorage.setItem('sg-sim-pace', '60')

    renderApp('/settings')

    expect(await screen.findByRole('heading', { name: 'Live Climate & Controls' })).toBeTruthy()

    for (const label of ['10 s/s', '20 s/s', '30 s/s', '60 s/s', '600 s/s', '6000 s/s']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: '60 s/s' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: '6000 s/s' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '6000 s/s' }).getAttribute('aria-pressed')).toBe('true')
    })

    const speedCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/speed'))
    expect(speedCall).toBeTruthy()
    const speedBody = JSON.parse((speedCall?.[1]?.body as string) ?? '{}')
    expect(speedBody.sim_seconds_per_real_second).toBe(6000)
    expect(window.localStorage.getItem('sg-sim-pace')).toBe('6000')

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/pause'))).toBe(true)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/resume'))).toBe(true)
    })
  })

  it('verify_src001_s0004_r003_a01 starts /control with operator control content instead of runtime controls', async () => {
    renderApp('/control')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.getByText('ControlPanel')).toBeTruthy()
    expect(screen.queryByText('AlertRail')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Live Climate & Controls' })).toBeNull()

    const bodyText = document.body.textContent ?? ''
    expect(bodyText.indexOf('RTROptimizerPanel')).toBeLessThan(bodyText.indexOf('ControlPanel'))
  })

  it('verify_src001_s0005_r001_a01 keeps /rtr limited to the RTR optimizer surface', async () => {
    renderApp('/rtr')

    expect(screen.getByTestId('topbar-title').textContent).toBe('RTR Optimizer')
    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.queryByText('ControlPanel')).toBeNull()
    expect(screen.queryByText('DecisionSnapshotGrid')).toBeNull()
    expect(screen.getByRole('button', { name: 'RTR Optimizer' }).getAttribute('aria-current')).toBe('step')
  })

  it('verify_src001_s0005_r002_a01 keeps removed panels reachable from their canonical tabs', async () => {
    renderApp('/rtr')

    expect(await screen.findByText('RTROptimizerPanel')).toBeTruthy()
    expect(screen.queryByText('ControlPanel')).toBeNull()
    expect(screen.queryByText('DecisionSnapshotGrid')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Control' }))

    await waitFor(() => {
      expect(screen.getByTestId('topbar-title').textContent).toBe('Control Solutions')
    })
    expect(await screen.findByText('ControlPanel')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Control' }).getAttribute('aria-current')).toBe('step')

    fireEvent.click(screen.getByRole('link', { name: 'INSIGHTS' }))

    await waitFor(() => {
      expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')
    })
    expect(await screen.findByText('DecisionSnapshotGrid')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trend' }).getAttribute('aria-current')).toBe('step')
  })

  it('opens the assistant drawer from the topbar without leaving the current shell page', async () => {
    renderApp('/trend')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle assistant' }))

    expect(await screen.findByText('AssistantDrawer:assistant-chat')).toBeTruthy()
    expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')
    expect(screen.getByRole('link', { name: 'INSIGHTS' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Trend' }).getAttribute('aria-current')).toBe('step')
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
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Alerts' }).getAttribute('aria-current')).toBe('step')
  })

  it('keeps trend as a dedicated page separated from control', async () => {
    renderApp('/trend')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')
    expect(await screen.findByText('WeatherOutlookPanel')).toBeTruthy()
    expect(await screen.findByText('DecisionSnapshotGrid')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'INSIGHTS' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Trend' }).getAttribute('aria-current')).toBe('step')
  })

  it('preserves /trend hook loading and error state plumbing when weather, produce, and overview signals are unavailable', async () => {
    weatherOutlookState.weather = null
    weatherOutlookState.loading = true
    weatherOutlookState.error = 'weather backend delayed'
    producePricesState.prices = null
    producePricesState.loading = false
    producePricesState.error = 'KAMIS unavailable'
    overviewSignalsState.signals = null
    overviewSignalsState.loading = true
    overviewSignalsState.error = 'overview signals unavailable'

    renderApp('/trend')

    expect(await screen.findByText('WeatherTrendPanel')).toBeTruthy()
    expect(screen.getByTestId('weather-trend-props').textContent).toContain('weather:null loading:true error:weather backend delayed')
    expect(screen.getByTestId('weather-outlook-props').textContent).toContain('weather:null loading:true error:weather backend delayed')
    expect(screen.getByTestId('produce-prices-props').textContent).toContain('prices:null loading:false error:KAMIS unavailable')
    expect(screen.getByTestId('decision-snapshot-props').textContent).toContain('weather:null weatherLoading:true')
    expect(screen.getByTestId('decision-snapshot-props').textContent).toContain('produce:null produceLoading:false')
    expect(screen.getByTestId('decision-snapshot-props').textContent).toContain('overview:null')
  })

  it('keeps crop-work as a dedicated page and dedups TodayBoard to its canonical HOME Watch tab', async () => {
    renderApp('/crop-work')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Crop Work')
    expect(await screen.findByText('CropDetails')).toBeTruthy()
    // R19 dedup: TodayBoard's canonical home is the HOME Watch tab only, so it no longer
    // renders on /crop-work (its data survives on HOME Watch — WatchTab.prd004.test.tsx).
    expect(screen.queryByText('TodayBoard')).toBeNull()
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Crop Work' }).getAttribute('aria-current')).toBe('step')
  })

  it.each([
    ['/ask#ask-chat', 'AskSearchPage:assistant-chat'],
    ['/ask#ask-search', 'AskSearchPage:assistant-search'],
    ['/ask#ask-history', 'AskSearchPage:assistant-search'],
    ['/ask/search#ask-search', 'AskSearchPage:assistant-search'],
    ['/ask/history#ask-chat', 'AskSearchPage:assistant-chat'],
    ['/assistant#ask-search', 'AskSearchPage:assistant-search'],
  ])('keeps legacy assistant hash compatibility for %s', async (path, expectedPanel) => {
    renderApp(path)

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()
    expect(await screen.findByText(expectedPanel)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('link', { name: 'KNOWLEDGE' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Assistant' }).getAttribute('aria-current')).toBe('step')
  })

  it.each([
    ['/control/legacy', 'Control Solutions'],
    ['/trend/legacy', 'Trend'],
    ['/rtr', 'RTR Optimizer'],
    ['/resources/legacy', 'Resources'],
    ['/alerts/legacy', 'Alerts'],
  ])('redirects %s to the canonical routed page', async (path, heading) => {
    renderApp(path)

    expect(screen.getByTestId('topbar-title').textContent).toBe(heading)
  })

  it('redirects the legacy overview path to the standalone overview landing', async () => {
    renderApp('/overview/legacy')

    expect(await screen.findByRole('heading', { name: 'AI decision platform for smart greenhouses.' })).toBeTruthy()
    expect(screen.queryByTestId('topbar-title')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open assistant fab' })).toBeTruthy()
  })

  it('opens the nutrient advisor lane through the live advisor tab surface', async () => {
    renderApp('/nutrient')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Resources')
    expect(await screen.findByText('AdvisorTabs')).toBeTruthy()
    expect(screen.getByTestId('advisor-initial-tab').textContent).toBe('nutrient')
    expect(screen.getByTestId('advisor-correction-open').textContent).toBe('false')
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Resources' }).getAttribute('aria-current')).toBe('step')
  })

  it('opens the harvest advisor lane through the live advisor tab surface', async () => {
    renderApp('/harvest')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Crop Work')
    expect(await screen.findByText('AdvisorTabs')).toBeTruthy()
    expect(screen.getByTestId('advisor-initial-tab').textContent).toBe('harvest_market')
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Crop Work' }).getAttribute('aria-current')).toBe('step')
  })

  it('keeps nested harvest advisor aliases on the live advisor tab surface', async () => {
    renderApp('/harvest/week')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Crop Work')
    expect(await screen.findByText('AdvisorTabs')).toBeTruthy()
    expect(screen.getByTestId('advisor-initial-tab').textContent).toBe('harvest_market')
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
  })

  it('opens the protection advisor lane through the live advisor tab surface', async () => {
    renderApp('/protection')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Alerts')
    expect(await screen.findByText('AdvisorTabs')).toBeTruthy()
    expect(screen.getByTestId('advisor-initial-tab').textContent).toBe('pesticide')
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Alerts' }).getAttribute('aria-current')).toBe('step')
  })

  it('keeps nested growth advisor aliases on the live advisor tab surface', async () => {
    renderApp('/growth/week#work')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Crop Work')
    expect(await screen.findByText('AdvisorTabs')).toBeTruthy()
    expect(screen.getByTestId('advisor-initial-tab').textContent).toBe('work')
    expect(screen.queryByRole('heading', { name: 'Today operations' })).toBeNull()
  })

  it('opens the assistant drawer when overview requests advisor detail', async () => {
    renderApp('/overview')

    expect(screen.queryByTestId('topbar-title')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open advisor lane' }))

    expect(await screen.findByText('AssistantDrawer:assistant-chat')).toBeTruthy()
    expect(screen.queryByText('AdvisorTabs')).toBeNull()
    expect(screen.queryByTestId('topbar-title')).toBeNull()
  })

  it('keeps the nutrient correction tool inside the knowledge flow instead of jumping to dashboard', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open nutrient correction' }))

    expect(screen.getByTestId('topbar-title').textContent).toBe('Assistant')
    expect(await screen.findByText('AskSearchPage:assistant-search')).toBeTruthy()
    expect(screen.queryByText('AdvisorTabs')).toBeNull()
    expect(screen.getByRole('link', { name: 'KNOWLEDGE' }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps assistant flows inline inside the assistant route', async () => {
    renderApp('/assistant')

    expect(await screen.findByRole('heading', { name: 'Assistant' })).toBeTruthy()
    expect(screen.getByText('AskSearchPage:assistant-chat')).toBeTruthy()
    // The 질문/자료 찾기 switch lives only in the WorkspaceTopNav action row now.
    expect(screen.queryByTestId('page-section-active')).toBeNull()
    expect(screen.getByRole('button', { name: 'Action:assistant-chat' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Action:assistant-search' }))
    expect(await screen.findByText('AskSearchPage:assistant-search')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Action:assistant-search' }).getAttribute('aria-pressed')).toBe('true')
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
    expect(screen.getByRole('button', { name: 'Action:assistant-chat' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('AssistantDrawer:assistant-chat')).toBeNull()
  })

  it('closes the assistant drawer before navigating to settings', async () => {
    renderApp('/trend')

    expect(screen.getByTestId('topbar-title').textContent).toBe('Trend')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle assistant' }))
    expect(await screen.findByText('AssistantDrawer:assistant-chat')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.queryByText('AssistantDrawer:assistant-chat')).toBeNull()
  })
})
