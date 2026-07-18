import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CloudSun } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { AdvancedModelMetrics, RtrProfile, SensorData } from '../../types';
import type { KpiTileData } from '../KpiStrip';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import {
  FinalCTA,
  HeroDecisionBrief,
  LandingFooter,
  LiveMetricStrip,
  OverviewMetricDeck,
  ScenarioOptimizerPreview,
  TodayActionBoard,
  TopNavigation,
  WeatherMarketKnowledgeBridge,
} from './overviewLandingSections';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8');
}

const SENSOR: SensorData = {
  timestamp: Date.UTC(2026, 3, 26, 9, 0, 0),
  temperature: 20.4,
  canopyTemp: 20.8,
  humidity: 78,
  co2: 600,
  light: 420,
  soilMoisture: 54,
  vpd: 0.92,
  transpiration: 2.7,
  stomatalConductance: 0.31,
  photosynthesis: 18.1,
  hFlux: 52,
  leFlux: 91,
  energyUsage: 12.6,
};

const MODEL_METRICS: AdvancedModelMetrics = {
  cropType: 'Tomato',
  growth: {
    lai: 3.2,
    biomass: 43,
    developmentStage: 'fruiting',
    growthRate: 1.1,
  },
  yield: {
    predictedWeekly: 27.6,
    confidence: 0.74,
    harvestableFruits: 118,
  },
  energy: {
    consumption: 12.6,
    costPrediction: 4200,
    efficiency: 0.82,
  },
};

const RTR_PROFILE: RtrProfile = {
  crop: 'Tomato',
  strategyLabel: 'House RTR profile',
  sourceNote: 'Test profile',
  baseTempC: 18.2,
  slopeCPerMjM2: 0.16,
  toleranceC: 0.8,
  lightToRadiantDivisor: 4.57,
  calibration: {
    mode: 'fitted',
    sampleDays: 14,
    fitStartDate: '2026-04-01',
    fitEndDate: '2026-04-14',
    minCoverageHours: 20,
    rSquared: 0.88,
    meanAbsoluteErrorC: 0.42,
  },
  optimizer: {
    enabled: true,
    default_mode: 'balanced',
    max_delta_temp_C: 1.2,
    max_rtr_ratio_delta: 0.18,
    temp_slew_rate_C_per_step: 0.4,
    weights: {
      temp: 1,
      node: 150,
      carbon: 120,
      sink: 80,
      resp: 20,
      risk: 120,
      energy: 25,
      labor: 20,
      assim: 90,
      yield: 70,
      heating: 25,
      cooling: 22,
      ventilation: 18,
      humidity: 80,
      disease: 80,
      stress: 75,
    },
  },
};

const KPI_TILE: KpiTileData = {
  key: 'vpd',
  label: 'VPD',
  value: 0.92,
  unit: 'kPa',
  availabilityState: 'live',
  availabilityLabel: 'Live',
  healthStatus: 'normal',
  trend: 'up',
  trendDetail: '1h change +0.1 kPa',
  icon: CloudSun,
  color: 'bg-emerald-500',
  lastReceived: '1 min ago',
  fractionDigits: 2,
};

const STRING_KPI_TILE: KpiTileData = {
  ...KPI_TILE,
  key: 'co2',
  label: 'CO₂',
  value: 'Receiving data',
  unit: 'ppm',
  availabilityState: 'delayed',
  availabilityLabel: 'Receiving',
  healthStatus: 'warning',
  trend: 'stable',
  trendDetail: 'Waiting for sensor',
  lastReceived: null,
};

function renderWithProviders(ui: ReactNode, locale: 'en' | 'ko' = 'en') {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);

  return render(
    <LocaleProvider>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </LocaleProvider>,
  );
}

describe('overview landing sections', () => {
  it('verify_src001_s0002_r002_a01 reuses the shared Command UI kit', () => {
    const overviewSections = readSource('components/dashboard/overviewLandingSections.tsx');
    const metricCard = readSource('components/ui/metric-card.tsx');
    const alertCard = readSource('components/ui/alert-card.tsx');
    const overviewPage = readSource('pages/overview-page.tsx');

    expect(overviewSections).toContain("from '../ui/section-header'");
    expect(overviewSections).toContain("from '../ui/button'");
    expect(overviewSections).toContain("from '../ui/status-chip'");
    expect(metricCard).toContain("from '../common/DashboardCard'");
    expect(alertCard).toContain("from '../common/DashboardCard'");
    expect(overviewPage).toContain("from '../components/ui/toggle-group'");
  });

  it('verify_src001_s0002_r003_a01 gives Command sections an eyebrow title and one-line description', () => {
    const { container } = renderWithProviders(
      <>
        <HeroDecisionBrief heroCard={<div>hero card</div>} />
        <LiveMetricStrip tiles={[KPI_TILE]} yieldOutlookKg={27.6} />
        <TodayActionBoard
          crop="Tomato"
          currentData={SENSOR}
          modelMetrics={MODEL_METRICS}
          actionsNow={[]}
          actionsToday={[]}
          monitor={[]}
          onOpenRtr={() => undefined}
          onOpenAdvisor={() => undefined}
        />
        <ScenarioOptimizerPreview
          crop="Tomato"
          currentData={SENSOR}
          history={[SENSOR]}
          modelMetrics={MODEL_METRICS}
          rtrProfile={RTR_PROFILE}
        />
        <WeatherMarketKnowledgeBridge
          crop="Tomato"
          weather={null}
          weatherLoading={false}
          weatherError={null}
          producePrices={null}
          produceLoading={false}
          produceError={null}
          knowledgeSummary={null}
          knowledgeLoading={false}
          knowledgeError={null}
          history={[SENSOR]}
          onOpenAssistant={() => undefined}
        />
        <FinalCTA />
      </>,
    );

    expect(container.querySelectorAll('.sg-eyebrow').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText('Unify climate, crop, market, and knowledge insight in one practical greenhouse command center.')).toBeTruthy();
    expect(screen.getByText('Sensor freshness')).toBeTruthy();
    expect(screen.getByText('Ventilation, irrigation, disease risk, and RTR scenario signals are grouped into action cards.')).toBeTruthy();
    expect(screen.getByText('Compare observed conditions with RTR profile targets. Actual recommended control values come from the optimizer surface in Control.')).toBeTruthy();
    expect(screen.getByText('Weather, market, and knowledge surfaces remain linked to the existing live data flow.')).toBeTruthy();
    expect(screen.getByText('Join growers who rely on PhytoSync every day.')).toBeTruthy();
  });

  it('verify_src001_s0002_r004_a01 renders numeric indicators as metric tiles with value unit and delta chips', () => {
    const { container } = renderWithProviders(
      <LiveMetricStrip tiles={[KPI_TILE]} yieldOutlookKg={27.6} />,
    );

    expect(container.querySelectorAll('.sg-data-number').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('kPa')).toBeTruthy();
    expect(screen.getByText('+0.1 kPa')).toBeTruthy();
    expect(screen.getByText('kg/wk')).toBeTruthy();
    expect(screen.getAllByText('weekly forecast')).toHaveLength(2);
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('dl')).toBeNull();
  });

  it('preserves unresolved sensor string values in the shared overview metric deck', () => {
    renderWithProviders(<OverviewMetricDeck tiles={[STRING_KPI_TILE]} />);

    expect(screen.getByText('Receiving data')).toBeTruthy();
    expect(screen.getByText('Receiving')).toBeTruthy();
    expect(screen.queryByText('-')).toBeNull();
    expect(screen.queryByText('ppm')).toBeNull();
  });

  it('verify_src001_s0002_r005_a01 keeps status and severity chips on the shared tone vocabulary', () => {
    const overviewSections = readSource('components/dashboard/overviewLandingSections.tsx');
    const metricCard = readSource('components/ui/metric-card.tsx');
    const alertCard = readSource('components/ui/alert-card.tsx');

    expect(metricCard).toContain("export type MetricTone = 'growth' | 'stable' | 'warning' | 'critical' | 'muted'");
    expect(alertCard).toContain("type AlertTone = 'growth' | 'stable' | 'warning' | 'critical' | 'muted'");
    expect(overviewSections).not.toContain('tone="normal"');
    expect(metricCard).not.toContain("'normal'");
    expect(alertCard).not.toContain("'normal'");
  });

  it('does not present fabricated setpoints as optimizer output', () => {
    renderWithProviders(
      <ScenarioOptimizerPreview
        crop="Tomato"
        currentData={SENSOR}
        history={[SENSOR]}
        modelMetrics={MODEL_METRICS}
        rtrProfile={RTR_PROFILE}
        analyticsNode={<div>analytics</div>}
        trendNode={<div>trend</div>}
      />,
    );

    expect(screen.getByText('Current state vs RTR guardrail')).toBeTruthy();
    // The redesign shows the optimizer status honestly in the header and no longer
    // renders a fabricated side-by-side setpoint table.
    expect(screen.getByText('Optimizer ready')).toBeTruthy();
    expect(screen.getByText('27.6 kg/wk')).toBeTruthy();
    // Current temp and RTR target are the only comparison; both are labelled.
    expect(screen.getByText('Current mean temp')).toBeTruthy();
    expect(screen.getByText('RTR target temp')).toBeTruthy();
    expect(screen.queryByText('AI recommended setpoints')).toBeNull();
    expect(screen.queryByText('680 ppm')).toBeNull();
    expect(screen.queryByText('15 min')).toBeNull();
  });

  it('surfaces weather, market, and knowledge errors instead of indefinite loading copy', () => {
    renderWithProviders(
      <WeatherMarketKnowledgeBridge
        crop="Tomato"
        weather={null}
        weatherLoading={false}
        weatherError="Weather backend unavailable"
        producePrices={null}
        produceLoading={false}
        produceError="Produce price service unavailable"
        knowledgeSummary={null}
        knowledgeLoading={false}
        knowledgeError="Knowledge catalog unavailable"
        history={[SENSOR]}
        onOpenAssistant={() => undefined}
      />,
    );

    expect(screen.getAllByText('Check connection')).toHaveLength(3);
    expect(screen.getByText('Weather backend unavailable')).toBeTruthy();
    expect(screen.getByText('Produce price service unavailable')).toBeTruthy();
    expect(screen.getByText('Knowledge catalog unavailable')).toBeTruthy();
  });

  it('renders prominent Korean landing copy when Korean locale is active', () => {
    renderWithProviders(
      <>
        <HeroDecisionBrief heroCard={<div>hero card</div>} />
        <FinalCTA />
        <LandingFooter onOpenAssistant={() => undefined} />
      </>,
      'ko',
    );

    expect(screen.getByRole('heading', { name: '스마트온실 인공지능 의사결정 플랫폼' })).toBeTruthy();
    expect(screen.getByText('대시보드 보기')).toBeTruthy();
    expect(screen.getByRole('button', { name: '무료로 시작' })).toBeTruthy();
    expect(screen.queryByText('AI decision platform for smart greenhouses.')).toBeNull();
  });

  it('routes landing navigation to live feature surfaces without dead hash anchors', () => {
    renderWithProviders(<TopNavigation onOpenAssistant={() => undefined} />);

    // Regression guard for issue #132: these previously pointed at #overview-dashboard
    // and #assistant-search anchors that do not exist on the standalone routes.
    expect(screen.getByRole('link', { name: 'HOME' }).getAttribute('href')).toBe('/overview');
    expect(screen.getByRole('link', { name: 'DASHBOARD' }).getAttribute('href')).toBe('/control');
    expect(screen.getByRole('link', { name: 'INSIGHTS' }).getAttribute('href')).toBe('/trend');
    expect(screen.getByRole('link', { name: 'SCENARIOS' }).getAttribute('href')).toBe('/scenarios');
    expect(screen.getByRole('link', { name: 'KNOWLEDGE' }).getAttribute('href')).toBe('/assistant');
    expect(screen.getByRole('button', { name: 'Ask Assistant' })).toBeTruthy();
    // CONTACT is a standalone page now, so it navigates like every other tab.
    expect(screen.getByRole('link', { name: 'CONTACT' }).getAttribute('href')).toBe('/contact');
    expect(screen.queryByRole('button', { name: 'CONTACT' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Dashboard' }).getAttribute('href')).toBe('/control');
  });

  it('does not reintroduce dead hash-anchor navigation targets', () => {
    renderWithProviders(<TopNavigation onOpenAssistant={() => undefined} />);

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').not.toContain('#overview-dashboard');
      expect(link.getAttribute('href') ?? '').not.toContain('#assistant-search');
    }
  });
});

describe('today action board RTR verdict', () => {
  const baseProps = {
    crop: 'Tomato' as const,
    currentData: SENSOR,
    modelMetrics: MODEL_METRICS,
    actionsNow: [] as string[],
    actionsToday: [] as string[],
    monitor: [] as string[],
    onOpenRtr: () => undefined,
    onOpenAdvisor: () => undefined,
  };

  it('shows a "below target — heat" verdict when current temp is under the band', () => {
    renderWithProviders(<TodayActionBoard {...baseProps} rtrDeltaC={-2.0} rtrToleranceC={0.8} />);
    expect(screen.getByText('2.0°C below the RTR target. Consider heating.')).toBeTruthy();
    expect(screen.getByText('Review setpoint')).toBeTruthy();
  });

  it('shows an "above target — vent" verdict when current temp is over the band', () => {
    renderWithProviders(<TodayActionBoard {...baseProps} rtrDeltaC={1.6} rtrToleranceC={0.8} />);
    expect(screen.getByText('1.6°C above the RTR target. Consider venting or shading.')).toBeTruthy();
    expect(screen.getByText('Review setpoint')).toBeTruthy();
  });

  it('shows a "within band — hold" verdict when current temp is inside the band', () => {
    renderWithProviders(<TodayActionBoard {...baseProps} rtrDeltaC={0.3} rtrToleranceC={0.8} />);
    expect(screen.getByText('Within the RTR target band. Hold the current temperature strategy.')).toBeTruthy();
    expect(screen.getByText('Within band')).toBeTruthy();
  });

  it('falls back to the static RTR copy when no delta is provided', () => {
    renderWithProviders(<TodayActionBoard {...baseProps} />);
    expect(screen.getByText(/Compare RTR target temperature before changing setpoints\./)).toBeTruthy();
  });
});
