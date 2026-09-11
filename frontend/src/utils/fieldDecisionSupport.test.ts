import { describe, expect, it } from 'vitest';
import type { SensorData } from '../types';
import { buildFieldDecisions, getSubstrateDemoScenarios, isDecisionRtrWindowUsable } from './fieldDecisionSupport';
import type { FieldDecisionInput, SituationId } from './fieldDecisionSupport';

// Real hook shape: an absent wire soil field can retain a finite display fallback.
const frame: SensorData = {
  timestamp: Date.UTC(2026, 8, 8, 9), temperature: 24, humidity: 70, vpd: 0.9,
  canopyTemp: 24.2, co2: 600, light: 300, soilMoisture: 60,
  transpiration: 2, stomatalConductance: 0.2, photosynthesis: 15,
  hFlux: 20, leFlux: 30, energyUsage: 1,
  fieldAvailability: { temperature: true, humidity: true, vpd: true, co2: true,
    light: true, stomatalConductance: true, soilMoisture: false },
  dataQuality: { status: 'ok', source: 'csv_replay', issues: [] }, simulationStatus: 'ok',
};
const input: FieldDecisionInput = { crop: 'Tomato', currentData: frame, telemetryStatus: 'live',
  rtrDeltaC: 0.1, rtrToleranceC: 0.8, rtrWindowHours: 24, locale: 'en' };
const card = (id: SituationId, overrides: Partial<FieldDecisionInput> = {}) =>
  buildFieldDecisions({ ...input, ...overrides }).find((row) => row.id === id)!;

describe('field decisions with reviewed context and explicit observations', () => {
  it('does not interpret missing wire soil data or generic percentages as irrigation thresholds', () => {
    expect(card('water').priority).toBe('data');
    for (const soilMoisture of [0, 31, 62, 99]) {
      const result = card('water', { currentData: { ...frame, soilMoisture,
        fieldAvailability: { ...frame.fieldAvailability!, soilMoisture: true } } });
      expect(result.priority).toBe('observe');
      expect(result.action).toContain('Check delivery');
      expect(result.action).not.toMatch(/earlier|increase irrigation|widen/i);
    }
  });

  it('preserves a reported zero VPD while refusing an unavailable placeholder', () => {
    const zero = { ...frame, vpd: 0 };
    expect(card('humidity', { currentData: zero }).reason).toContain('0.00 kPa');
    expect(card('humidity', { currentData: zero }).priority).toBe('today');
    expect(card('humidity', { currentData: { ...zero,
      fieldAvailability: { ...zero.fieldAvailability!, vpd: false } } }).priority).toBe('data');
  });

  it.each(['stale', 'offline', 'loading'] as const)('does not use %s context for climate action', (telemetryStatus) => {
    const cards = buildFieldDecisions({ ...input, telemetryStatus,
      currentData: { ...frame, vpd: 2.8, humidity: 96 } });
    expect(cards.some((row) => row.priority === 'first' || row.priority === 'today')).toBe(false);
    expect(cards.find((row) => row.id === 'humidity')!.reason).not.toContain('2.80');
  });

  it.each([
    { ...frame, dataQuality: { status: 'invalid' as const, issues: [{ field: 'RH_percent', reason: 'missing' }] } },
    { ...frame, simulationStatus: 'unconverged' },
  ])('does not reuse a failed frame but preserves independent field observations', (currentData) => {
    expect(card('humidity', { currentData }).priority).toBe('data');
    const wetWilt = card('water', { currentData, observations: { wilting: 'yes', rootMoisture: 'wet' } });
    expect(wetWilt.priority).toBe('first');
    expect(wetWilt.action).toMatch(/roots.*graft.*diagnosis/i);
    expect(wetWilt.basis).toContain('User-entered');
  });

  it('changes the actual branch with the substrate demo and labels the invented values', () => {
    expect(getSubstrateDemoScenarios('en').map((row) => row.id)).toEqual(['balanced', 'interrupted', 'wetWilt', 'off']);
    const normal = card('water', { substrateDemo: 'balanced' });
    const dry = card('water', { substrateDemo: 'interrupted' });
    const wet = card('water', { substrateDemo: 'wetWilt' });
    expect(normal.priority).toBe('observe');
    expect(dry.priority).toBe('first');
    expect(dry.action).toContain('delivery path');
    expect(wet.action).toContain('field diagnosis');
    expect(wet.action).not.toMatch(/increase irrigation|irrigate more/i);
    expect(dry.basis).toMatch(/Selected substrate conditions.*not irrigation thresholds/i);
    expect(card('water', { substrateDemo: 'off' }).priority).toBe('data');
  });

  it('allows an explicit unknown to override the demo instead of confirming it again', () => {
    const result = card('water', { substrateDemo: 'interrupted',
      observations: { wilting: 'unknown', delivery: 'unknown', rootMoisture: 'unknown' } });
    expect(result.priority).toBe('data');
    expect(result.basis).toMatch(/manually entered/i);
    const changed = card('water', { substrateDemo: 'balanced', observations: { delivery: 'stopped' } });
    expect(changed.reason).not.toContain('delivery confirmed');
    expect(changed.reason).toContain('failed delivery');
  });

  it('keeps unsupported observation values unknown and diagnoses no disease from RH alone', () => {
    expect(card('water', { observations: { delivery: 'fixed by me' } }).priority).toBe('data');
    const result = card('humidity', { currentData: { ...frame, humidity: 96, vpd: 0.1 } });
    expect(result.priority).toBe('today');
    expect(result.confirm.join(' ')).toContain('wetness duration');
    expect(result.action).not.toMatch(/spray|fungicide|close.*vents/i);
  });

  it('asks about injection and measurement on EC/pH mismatch without implying crop recovery', () => {
    const result = card('nutrition', { crop: 'Cucumber', observations: { supplyMismatch: 'yes' } });
    expect(result.action).toContain('stock/acid');
    expect(result.action).toContain('remeasure');
    expect(result.recheck).toContain('separately');
    expect(result.evidence.some((row) => row.id === 'OBS-K03')).toBe(true);
  });

  it('limits daily RTR comparison to a usable window and never validates holding settings', () => {
    expect(card('rtr').priority).toBe('observe');
    expect(card('rtr').action).not.toMatch(/can stay|maintain|hold/i);
    expect(card('rtr', { rtrDeltaC: -3 }).priority).toBe('today');
    for (const args of [{ rtrWindowHours: 8 }, { rtrWindowHours: undefined },
      { rtrToleranceC: 0 }, { rtrToleranceC: Number.NaN }, { rtrDeltaC: Number.NaN }, { rtrWindowUsable: false }]) {
      expect(card('rtr', args).priority).toBe('data');
    }
    expect(card('rtr', { observations: { stage: 'establishing' } }).action).toContain('Absence of fruit does not remove');
  });

  it('rejects the real RTR two-point extrapolation and invalid historical placeholders', () => {
    const two = [{ ...frame, timestamp: frame.timestamp - 12 * 3_600_000 }, frame];
    expect(isDecisionRtrWindowUsable(two, frame)).toBe(false);
    const day = Array.from({ length: 145 }, (_, i) => ({ ...frame, timestamp: frame.timestamp - (144 - i) * 600_000 }));
    expect(isDecisionRtrWindowUsable(day, frame)).toBe(true);
    expect(isDecisionRtrWindowUsable(day.map((row, i) => i === 40 ? { ...row,
      fieldAvailability: { ...row.fieldAvailability!, light: false } } : row), frame)).toBe(false);
    expect(isDecisionRtrWindowUsable(day.map((row, i) => i === 40 ? { ...row, simulationStatus: 'unconverged' } : row), frame)).toBe(false);
    expect(isDecisionRtrWindowUsable(day.filter((_, i) => i < 40 || i > 55), frame)).toBe(false);
  });

  it('keeps execution distinct from partial recovery and unexecuted plans', () => {
    const partial = card('followup', { observations: { execution: 'done', response: 'partial' } });
    expect(partial.reason).toContain('Residual symptoms');
    expect(partial.action).toContain('remaining symptoms');
    expect(card('followup', { observations: { execution: 'planned', response: 'improved' } }).action).toContain('not confirmed as executed');
    expect(card('followup', { observations: { response: 'worse' } }).priority).toBe('first');
  });

  it('uses retained crop-specific or shared sources, never excluded audio or mixed-crop records', () => {
    for (const crop of ['Tomato', 'Cucumber'] as const) {
      const evidence = buildFieldDecisions({ ...input, crop }).flatMap((row) => row.evidence);
      expect(evidence.some((row) => row.id === 'WEB-09')).toBe(true);
      expect(evidence.every((row) => row.limits.length > 0 && row.locator.length > 0)).toBe(true);
      expect(evidence.some((row) => /ASR|AUDIO|KR-07|KR-08/.test(row.id))).toBe(false);
      expect(evidence.some((row) => row.id === (crop === 'Tomato' ? 'KR-01' : 'KR-03'))).toBe(false);
    }
  });
});
