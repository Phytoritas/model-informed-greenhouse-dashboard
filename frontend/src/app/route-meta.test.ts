import { describe, expect, it } from 'vitest';
import {
  buildPrimaryRoutes,
  getPrimaryRouteKey,
  getPrimaryRouteMeta,
} from './route-meta';

describe('route-meta', () => {
  it('builds the PhytoSync top-level route set in order', () => {
    const koRoutes = buildPrimaryRoutes('ko');
    const enRoutes = buildPrimaryRoutes('en');

    expect(koRoutes.map((route) => route.key)).toEqual([
      'overview',
      'control',
      'scenarios',
      'trend',
      'crop-work',
      'resources',
      'alerts',
      'assistant',
      'settings',
    ]);
    expect(enRoutes.map((route) => route.key)).toEqual(koRoutes.map((route) => route.key));
  });

  it('maps direct and legacy paths to the new top-level route keys', () => {
    expect(getPrimaryRouteKey('/overview')).toBe('overview');
    expect(getPrimaryRouteKey('/control')).toBe('control');
    expect(getPrimaryRouteKey('/dashboard')).toBe('control');
    expect(getPrimaryRouteKey('/trend')).toBe('trend');
    expect(getPrimaryRouteKey('/rtr')).toBe('control');
    expect(getPrimaryRouteKey('/scenarios')).toBe('scenarios');
    expect(getPrimaryRouteKey('/crop-work')).toBe('crop-work');
    expect(getPrimaryRouteKey('/assistant')).toBe('assistant');
    expect(getPrimaryRouteKey('/settings')).toBe('settings');

    expect(getPrimaryRouteKey('/growth')).toBe('crop-work');
    expect(getPrimaryRouteKey('/nutrient')).toBe('resources');
    expect(getPrimaryRouteKey('/protection')).toBe('alerts');
    expect(getPrimaryRouteKey('/harvest')).toBe('crop-work');
    expect(getPrimaryRouteKey('/ask')).toBe('assistant');
  });

  it('returns localized metadata for the active route', () => {
    expect(getPrimaryRouteMeta('/overview', 'ko').title).toBe('오늘 운영');
    expect(getPrimaryRouteMeta('/trend', 'ko').label).toBe('날씨와 시세');
    expect(getPrimaryRouteMeta('/assistant', 'ko').label).toBe('질문 도우미');
    expect(getPrimaryRouteMeta('/settings', 'en').label).toBe('Contact');
    expect(getPrimaryRouteMeta('/rtr', 'en').title).toBe('Climate Solutions');
    expect(getPrimaryRouteMeta('/scenarios', 'en').title).toBe('Greenhouse adjustment review');
  });
});
