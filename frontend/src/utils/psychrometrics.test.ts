import { describe, expect, it } from 'vitest';
import type { SensorData } from '../types';
import { calculatePsychrometrics, psychrometricsFromFrame, selectPsychrometricFrame } from './psychrometrics';

const frame = (timestamp: number, humidity = 50): SensorData => ({
  timestamp, temperature: 25, humidity, canopyTemp: 24, co2: 400, light: 0,
  soilMoisture: 0, vpd: 0, transpiration: 0, stomatalConductance: 0,
  photosynthesis: 0, hFlux: 0, leFlux: 0, energyUsage: 0,
});

describe('psychrometric decision quantities', () => {
  it('matches the 25°C, 50% RH reference state with dry-air units', () => {
    const state = calculatePsychrometrics(25, 50)!;
    expect(state.vaporPressureKPa).toBeCloseTo(1.584, 3);
    expect(state.vpdKPa).toBeCloseTo(1.584, 3);
    expect(state.humidityRatioGKg).toBeCloseTo(9.877, 2);
    expect(state.enthalpyKJkg).toBeCloseTo(50.41, 1);
    expect(state.dewPointC).toBeCloseTo(13.86, 2);
    expect(calculatePsychrometrics(25, 50, 90)!.humidityRatioGKg).toBeGreaterThan(state.humidityRatioGKg);
  });

  it('preserves saturation and genuinely dry air without fictitious dew points', () => {
    expect(calculatePsychrometrics(25, 100)!.vpdKPa).toBe(0);
    expect(calculatePsychrometrics(25, 100)!.dewPointC).toBeCloseTo(25, 10);
    expect(calculatePsychrometrics(25, 0)!.humidityRatioGKg).toBe(0);
    expect(calculatePsychrometrics(25, 0)!.dewPointC).toBeNull();
    expect(calculatePsychrometrics(0, 100)!.dewPointC).toBe(0);
  });

  it('rejects invalid inputs, invalid frames and unavailable fields', () => {
    for (const args of [[NaN, 50], [-1, 50], [51, 50], [25, -1], [25, 101], [25, Infinity], [25, 100, 1]]) {
      expect(calculatePsychrometrics(args[0], args[1], args[2])).toBeNull();
    }
    expect(psychrometricsFromFrame(null)).toBeNull();
    expect(psychrometricsFromFrame({ ...frame(1), simulationStatus: 'solver_failed' })).toBeNull();
    expect(psychrometricsFromFrame({ ...frame(1), dataQuality: { status: 'invalid', issues: [] } })).toBeNull();
    expect(psychrometricsFromFrame({ ...frame(1), fieldAvailability: {
      temperature: true, humidity: false, co2: true, light: true, vpd: true, stomatalConductance: true,
    } })).toBeNull();
  });

  it('keeps replay selection causal and does not skip the latest missing frame', () => {
    const missing = { ...frame(30), humidity: NaN };
    const history = [frame(20), frame(10), missing];
    expect(selectPsychrometricFrame(history, 9)).toBeNull();
    expect(selectPsychrometricFrame(history, 25)?.timestamp).toBe(20);
    expect(selectPsychrometricFrame(history, null)).toBe(missing);
    expect(psychrometricsFromFrame(selectPsychrometricFrame(history, null))).toBeNull();
    expect(selectPsychrometricFrame([], null)).toBeNull();
  });
});
