import { describe, expect, it } from 'vitest';
import {
  CONTROL_DISPLAY_COPY,
  RUNTIME_CONSTRAINT_DISPLAY_COPY,
  getControlDisplayCopy,
  getRuntimeConstraintDisplayCopy,
} from './displayCopy';

describe('displayCopy friendly control and constraint copy', () => {
  const backendConstraintCodes = [
    'trust_region_exceeded',
    'disease_risk_high',
    'humidity_floor_risk',
    'screen_humidity_coupling',
    'heat_stress_risk',
    'cold_stress_risk',
    'night_cold_risk',
    'co2_overdose_risk',
    'source_loss_risk',
  ] as const;

  it('keeps a single dictionary for required control and risk identifiers', () => {
    expect(CONTROL_DISPLAY_COPY.rh_target.label.ko).toBe('상대습도 목표');
    expect(CONTROL_DISPLAY_COPY.co2_target.label.ko).toBe('이산화탄소 목표');
    expect(CONTROL_DISPLAY_COPY.heating_set_C.label.ko).toBe('난방 설정 온도');
    expect(RUNTIME_CONSTRAINT_DISPLAY_COPY.humidity_floor_risk.title.ko).toBe('습도 회복 하한 위험');
  });

  it('localizes known control identifiers without exposing snake_case labels', () => {
    expect(getControlDisplayCopy('rh_target', 'ko')).toMatchObject({
      label: '상대습도 목표',
      compactLabel: '습도 목표',
      unit: '%p',
      fallback: false,
    });
    expect(getControlDisplayCopy('co2_setpoint_day', 'en')).toMatchObject({
      label: 'Day CO₂ target',
      compactLabel: 'Day CO₂',
      unit: 'ppm',
      fallback: false,
    });
  });

  it('maps the rh_target humidity floor risk to farmer-friendly Korean alert copy', () => {
    const copy = getRuntimeConstraintDisplayCopy({
      control: 'rh_target',
      code: 'humidity_floor_risk',
    }, 'ko');

    expect(copy.title).toBe('습도 회복 하한 위험');
    expect(copy.body).toBe('습도 목표를 낮추면 상대습도가 회복 하한 아래로 떨어질 수 있어요. 현재 설정을 확인해 주세요.');
    expect(copy.title).not.toContain('rh_target');
    expect(copy.body).not.toContain('humidity_floor_risk');
    expect(copy.auxiliaryText).toBeUndefined();
  });

  it('maps all current backend constraint codes before falling back to source-code text', () => {
    backendConstraintCodes.forEach((code) => {
      const copy = getRuntimeConstraintDisplayCopy({
        control: code === 'co2_overdose_risk' ? 'co2_setpoint_day' : 'rh_target',
        code,
      }, 'ko');

      expect(copy.fallback).toBe(false);
      expect(copy.title.trim()).not.toBe('');
      expect(copy.body.trim()).not.toBe('');
      expect(copy.auxiliaryText).toBeUndefined();
      expect(copy.title).not.toContain(code);
      expect(copy.body).not.toContain(code);
    });
  });

  it('uses non-empty fallback copy and compressed source-code text for unknown constraints', () => {
    const copy = getRuntimeConstraintDisplayCopy({
      control: 'unknown_control',
      code: 'custom_floor_risk',
    }, 'ko');

    expect(copy.title).toBe('운영 제약 확인 필요');
    expect(copy.body).toContain('사전에 없는 운영 제약이 감지되었습니다.');
    expect(copy.title.trim()).not.toBe('');
    expect(copy.body.trim()).not.toBe('');
    expect(copy.auxiliaryText).toBe('원문 코드: unknown_control · custom_floor_risk');
  });
});
