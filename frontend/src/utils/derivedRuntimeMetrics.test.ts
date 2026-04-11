import { describe, expect, it } from 'vitest';
import type { AdvancedModelMetrics, SensorData } from '../types';
import { deriveSourceSinkBalance } from './derivedRuntimeMetrics';

const baseSensorData: SensorData = {
  timestamp: Date.now(),
  temperature: 24.1,
  canopyTemp: 23.9,
  humidity: 71,
  co2: 640,
  light: 420,
  soilMoisture: 0,
  vpd: 0.8,
  transpiration: 0.15,
  stomatalConductance: 0.31,
  photosynthesis: 15.6,
  hFlux: 0,
  leFlux: 0,
  energyUsage: 0,
};

const baseMetrics: AdvancedModelMetrics = {
  cropType: 'Cucumber',
  growth: {
    lai: 3.1,
    biomass: 620,
    developmentStage: 'vegetative',
    growthRate: 2.5,
    nodeCount: 32,
  },
  yield: {
    predictedWeekly: 120,
    confidence: 0.75,
    harvestableFruits: 28,
  },
  energy: {
    consumption: 8.1,
    costPrediction: 1200,
    efficiency: 3.2,
  },
};

describe('deriveSourceSinkBalance', () => {
  it('returns a finite value for cucumber metrics', () => {
    const result = deriveSourceSinkBalance({
      crop: 'Cucumber',
      currentData: baseSensorData,
      metrics: baseMetrics,
    });
    expect(Number.isFinite(result)).toBe(true);
  });

  it('returns a finite value for tomato metrics', () => {
    const result = deriveSourceSinkBalance({
      crop: 'Tomato',
      currentData: baseSensorData,
      metrics: {
        ...baseMetrics,
        cropType: 'Tomato',
        growth: {
          ...baseMetrics.growth,
          activeTrusses: 7,
          nodeCount: undefined,
        },
      },
    });
    expect(Number.isFinite(result)).toBe(true);
  });

  it('falls back to default fruit load when growth/yield inputs are missing', () => {
    const result = deriveSourceSinkBalance({
      crop: 'Tomato',
      currentData: {
        ...baseSensorData,
        photosynthesis: 0,
      },
      metrics: {
        ...baseMetrics,
        cropType: 'Tomato',
        growth: {
          ...baseMetrics.growth,
          activeTrusses: undefined,
          nodeCount: undefined,
        },
        yield: {
          ...baseMetrics.yield,
          predictedWeekly: 0,
          harvestableFruits: 0,
        },
      },
    });
    expect(Number.isFinite(result)).toBe(true);
  });
});
