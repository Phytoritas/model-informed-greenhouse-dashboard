import { fireEvent, render, screen, within } from '@testing-library/react';
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

// The six situations the board now presents, in English.
const SITUATION_TITLES = [
  'Wilting and actual water delivery',
  'Surface wetness and moisture removal',
  'Feed EC/pH versus settings',
  'Light, mean temperature and fruit load',
  'CO₂ supply and ventilation',
  'Execution and crop response',
];

/** The card for one situation, found through its heading. */
function cardFor(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: title });
  const card = heading.closest('article');
  if (!card) {
    throw new Error('No card rendered for ' + title);
  }
  return card as HTMLElement;
}

describe('overview landing sections', () => {
  it('presents latest measurements and one set of decisions with their purpose', () => {
    renderWithProviders(
      <>
        <LiveMetricStrip tiles={[KPI_TILE]} yieldOutlookKg={27.6} />
        <TodayActionBoard
          crop="Tomato"
          currentData={SENSOR}
          modelMetrics={MODEL_METRICS}
          actionsNow={['Schedule harvest labor.']}
          actionsToday={['Inspect fruit grading.']}
          monitor={['Review market prices.']}
          onOpenRtr={() => undefined}
          onOpenAdvisor={() => undefined}
        />
      </>,
    );

    expect(screen.getByRole('region', { name: 'Live decision metrics' })).toBeTruthy();
    expect(screen.getAllByRole('region', { name: 'What to check now' })).toHaveLength(1);
    expect(screen.getByText('Sensor freshness')).toBeTruthy();
    expect(screen.getByText(
      'For each situation: why it is showing, what to confirm in the crop, and what to do next.',
    )).toBeTruthy();
    // Six situations, each named once, replace the old per-sensor traffic lights.
    for (const title of SITUATION_TITLES) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }
    // Advisor task feeds are still never shown as a card justification.
    expect(screen.queryByText(/Schedule harvest labor|Inspect fruit grading|Review market prices/)).toBeNull();
    // The upgraded board no longer states a universal soil-moisture verdict.
    expect(screen.queryByText(/Soil moisture 54\.0%/)).toBeNull();
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

  it('presents the same decision and data-check distinction in Korean', () => {
    renderWithProviders(
      <TodayActionBoard
        crop="Tomato"
        currentData={SENSOR}
        modelMetrics={MODEL_METRICS}
        actionsNow={[]}
        actionsToday={[]}
        monitor={[]}
        onOpenRtr={() => undefined}
        onOpenAdvisor={() => undefined}
        telemetryStatus="offline"
      />,
      'ko',
    );

    expect(screen.getByRole('heading', { name: '지금 확인할 일' })).toBeTruthy();
    expect(screen.getAllByText('데이터 확인').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '시듦과 실제 급액' })).toBeTruthy();
    expect(screen.getAllByText('예시').length).toBeGreaterThan(0);
    // The board states priorities per situation and never a blanket all-clear.
    expect(screen.queryByText('지금 급한 항목은 없습니다')).toBeNull();
    expect(screen.queryByRole('button', { name: '무료로 시작' })).toBeNull();
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
    expect(screen.queryByRole('link', { name: 'CONTACT' })).toBeNull();
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

describe('today action board field decisions', () => {
  const baseProps = {
    crop: 'Tomato' as const, currentData: SENSOR, modelMetrics: MODEL_METRICS,
    onOpenRtr: () => undefined, onOpenAdvisor: () => undefined,
    rtrDeltaC: 0.1, rtrToleranceC: 0.8, rtrWindowHours: 24,
  };
  const pickDemo = (value: string) => fireEvent.change(screen.getByLabelText(/Substrate conditions/), { target: { value } });
  const openInputs = (card: HTMLElement) => fireEvent.click(card.querySelector('details > summary')!);

  it('shows reference differences as a review prompt, not permission to hold settings', () => {
    renderWithProviders(<TodayActionBoard {...baseProps} />);
    const rtr = cardFor('Light, mean temperature and fruit load');
    expect(within(rtr).getByText(/configured reference is \+0.1°C/)).toBeTruthy();
    expect(within(rtr).getByText('Observe')).toBeTruthy();
    expect(screen.queryByText(/current temperature setting can stay|Nothing urgent right now/)).toBeNull();
  });

  it('leaves an incomplete daily comparison pending even with a large delta', () => {
    renderWithProviders(<TodayActionBoard {...baseProps} rtrDeltaC={-3} rtrWindowHours={8} />);
    const rtr = cardFor('Light, mean temperature and fruit load');
    expect(within(rtr).getByText('Confirm data')).toBeTruthy();
    expect(within(rtr).getByText(/8.0 hours/)).toBeTruthy();
    expect(screen.queryByText(/Try a heating setting/)).toBeNull();
  });

  it.each([
    { reason: 'stale transport', data: SENSOR, telemetryStatus: 'stale' as const },
    { reason: 'invalid source', data: { ...SENSOR, dataQuality: { status: 'invalid', issues: [] } } as SensorData, telemetryStatus: 'live' as const },
    { reason: 'failed model', data: { ...SENSOR, simulationStatus: 'unconverged' }, telemetryStatus: 'live' as const },
  ])('keeps a labeled substrate demo but no numeric climate verdict for $reason', ({ data, telemetryStatus }) => {
    renderWithProviders(<TodayActionBoard {...baseProps} currentData={data} telemetryStatus={telemetryStatus}
      actionsNow={['Increase ventilation now.']} actionsToday={['Irrigate immediately.']} />);
    expect(within(cardFor('Surface wetness and moisture removal')).getByText('Confirm data')).toBeTruthy();
    expect(within(cardFor('Wilting and actual water delivery')).getByText('Example')).toBeTruthy();
    expect(screen.queryByText(/Increase ventilation now|Irrigate immediately|Nothing urgent right now/)).toBeNull();
  });

  it('switches the actual water decision between interrupted supply and wet wilting', () => {
    renderWithProviders(<TodayActionBoard {...baseProps} compact />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Wilting and actual water delivery' })).toBeTruthy();
    pickDemo('interrupted');
    let water = cardFor('Wilting and actual water delivery');
    expect(within(water).getByText('Check first')).toBeTruthy();
    expect(within(water).getByText(/address the confirmed supply problem/)).toBeTruthy();
    pickDemo('wetWilt');
    water = cardFor('Wilting and actual water delivery');
    expect(within(water).getByText(/arrange field diagnosis/)).toBeTruthy();
    expect(within(water).queryByText(/increase irrigation|irrigate more/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show 4 more' }));
    expect(screen.getAllByRole('article')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('keeps unknown explicit, clears overrides, and updates the conditional decision', () => {
    renderWithProviders(<TodayActionBoard {...baseProps} />);
    pickDemo('interrupted');
    const water = cardFor('Wilting and actual water delivery');
    openInputs(water);
    for (const label of ['Wilting on the same plants', 'Actual delivery at the dripper', 'Substrate checked at root depth']) {
      fireEvent.change(within(water).getByLabelText(label), { target: { value: 'unknown' } });
    }
    expect(within(water).queryByText('Check first')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear entries' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear entries' }));
    expect(within(water).getByText('Check first')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear entries' })).toBeNull();
  });

  it('preserves partial recovery and does not infer execution from an improved response', () => {
    renderWithProviders(<TodayActionBoard {...baseProps} />);
    const follow = cardFor('Execution and crop response');
    openInputs(follow);
    fireEvent.change(within(follow).getByLabelText('Execution of the action being reviewed'), { target: { value: 'done' } });
    fireEvent.change(within(follow).getByLabelText('Follow-up on the same plants or area'), { target: { value: 'partial' } });
    expect(within(follow).getByText(/Residual symptoms/)).toBeTruthy();
    fireEvent.change(within(follow).getByLabelText('Execution of the action being reviewed'), { target: { value: 'planned' } });
    fireEvent.change(within(follow).getByLabelText('Follow-up on the same plants or area'), { target: { value: 'improved' } });
    expect(within(follow).getByText(/not confirmed as executed/)).toBeTruthy();
  });

  it('retains entries across frame ticks but resets on the displayed local day or crop', () => {
    const at = new Date(2026, 8, 8, 23, 55).getTime();
    const Wrapped = ({ time, crop = 'Tomato' }: { time: number; crop?: 'Tomato' | 'Cucumber' }) => (
      <LocaleProvider><MemoryRouter><TodayActionBoard {...baseProps} crop={crop} simulatedTimestamp={time} /></MemoryRouter></LocaleProvider>
    );
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    const { rerender } = render(<Wrapped time={at} />);
    let nutrition = cardFor('Feed EC/pH versus settings');
    openInputs(nutrition);
    fireEvent.change(within(nutrition).getByLabelText(/Setpoint versus dripper/), { target: { value: 'yes' } });
    rerender(<Wrapped time={at + 60_000} />);
    expect(screen.getByRole('button', { name: 'Clear entries' })).toBeTruthy();
    rerender(<Wrapped time={at + 10 * 60_000} />);
    expect(screen.queryByRole('button', { name: 'Clear entries' })).toBeNull();
    nutrition = cardFor('Feed EC/pH versus settings');
    openInputs(nutrition);
    fireEvent.change(within(nutrition).getByLabelText(/Setpoint versus dripper/), { target: { value: 'yes' } });
    rerender(<Wrapped time={at + 10 * 60_000} crop="Cucumber" />);
    expect(screen.queryByRole('button', { name: 'Clear entries' })).toBeNull();
  });
});
