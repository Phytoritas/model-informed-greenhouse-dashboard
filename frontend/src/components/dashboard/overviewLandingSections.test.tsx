import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Sprout } from 'lucide-react';
import type { AdvancedModelMetrics, RtrProfile, SensorData } from '../../types';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import {
  FinalCTA,
  HeroDecisionBrief,
  LandingFooter,
  LiveMetricStrip,
  ScenarioOptimizerPreview,
  TopNavigation,
  WeatherMarketKnowledgeBridge,
} from './overviewLandingSections';

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
    expect(screen.getByText('Optimizer available')).toBeTruthy();
    expect(screen.getByText('27.6 kg/wk')).toBeTruthy();
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
    expect(screen.getByText('온실 환경 보기')).toBeTruthy();
    expect(screen.getByRole('button', { name: '무료로 시작' })).toBeTruthy();
    expect(screen.queryByText('AI decision platform for smart greenhouses.')).toBeNull();
  });

  it('routes landing navigation to the full feature surfaces', () => {
    renderWithProviders(<TopNavigation onOpenAssistant={() => undefined} />);

    expect(screen.getByRole('link', { name: '온실환경' }).getAttribute('href')).toBe('/control');
    expect(screen.getByRole('link', { name: '날씨·시세' }).getAttribute('href')).toBe('/trend');
    expect(screen.getByRole('link', { name: '조정검토' }).getAttribute('href')).toBe('/scenarios');
    expect(screen.getByRole('link', { name: '자료·질문' }).getAttribute('href')).toBe('/knowledge#assistant-search');
    expect(screen.getByRole('button', { name: '질문하기' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '운영 화면 열기' }).getAttribute('href')).toBe('/control');
  });

  it('renders visible trend charts in the live metric strip', () => {
    const tiles = [
      {
        key: 'temperature',
        label: '온도',
        value: 22.4,
        unit: '°C',
        availabilityState: 'live' as const,
        availabilityLabel: '정상',
        healthStatus: 'normal' as const,
        trend: 'up' as const,
        trendDetail: '1h 변화 +0.4°C',
        icon: Sprout,
        color: 'bg-[color:var(--sg-color-olive)]',
        lastReceived: '방금',
      },
      {
        key: 'co2',
        label: '이산화탄소',
        value: 720,
        unit: 'ppm',
        availabilityState: 'live' as const,
        availabilityLabel: '정상',
        healthStatus: 'normal' as const,
        trend: 'stable' as const,
        trendDetail: '1h 변화 +8ppm',
        icon: Sprout,
        color: 'bg-[color:var(--sg-color-sage)]',
        lastReceived: '방금',
      },
    ];
    const history = [20.8, 21.2, 21.7, 22.4].map((temperature, index) => ({
      ...SENSOR,
      timestamp: SENSOR.timestamp + index * 60_000,
      temperature,
      co2: 650 + index * 20,
    }));

    renderWithProviders(
      <LiveMetricStrip
        tiles={tiles}
        yieldOutlookKg={MODEL_METRICS.yield.predictedWeekly}
        history={history}
        metricHistory={[
          {
            timestamp: SENSOR.timestamp,
            lai: 3.1,
            biomass: 42,
            growthRate: 1,
            predictedWeeklyYield: 26.8,
            harvestableFruits: 116,
            energyConsumption: 12.1,
            energyLoadKw: 4.2,
            energyEfficiency: 0.8,
          },
          {
            timestamp: SENSOR.timestamp + 60_000,
            lai: 3.2,
            biomass: 43,
            growthRate: 1.1,
            predictedWeeklyYield: 27.6,
            harvestableFruits: 118,
            energyConsumption: 12.6,
            energyLoadKw: 4.4,
            energyEfficiency: 0.82,
          },
        ]}
      />,
      'ko',
    );

    expect(screen.getByRole('img', { name: '온도 최근 흐름' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '이산화탄소 최근 흐름' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '수확 전망 최근 흐름' })).toBeTruthy();
  });
});
