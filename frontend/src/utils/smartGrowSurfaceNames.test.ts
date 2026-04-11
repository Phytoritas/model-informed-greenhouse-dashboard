import { describe, expect, it } from 'vitest';
import {
  localizeSmartGrowSurfaceName,
  localizeSmartGrowSurfaceNames,
} from './smartGrowSurfaceNames';

describe('smartGrowSurfaceNames', () => {
  it('localizes known surface names to Korean labels', () => {
    expect(localizeSmartGrowSurfaceName('environment', 'ko')).toBe('환경');
    expect(localizeSmartGrowSurfaceName('nutrient_correction', 'ko')).toBe('양액 보정');
    expect(localizeSmartGrowSurfaceName('physiology', 'ko')).toBe('생육');
  });

  it('normalizes spaces and dashes before localization', () => {
    expect(localizeSmartGrowSurfaceName('Nutrient Correction', 'ko')).toBe('양액 보정');
    expect(localizeSmartGrowSurfaceName('nutrient-correction', 'ko')).toBe('양액 보정');
  });

  it('keeps unknown values as-is', () => {
    expect(localizeSmartGrowSurfaceName('custom_surface', 'ko')).toBe('custom_surface');
  });

  it('localizes lists while preserving order', () => {
    expect(localizeSmartGrowSurfaceNames(['environment', 'harvest', 'work'], 'ko')).toEqual([
      '환경',
      '수확',
      '작업',
    ]);
  });
});
