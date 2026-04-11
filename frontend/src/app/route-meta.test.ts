import { describe, expect, it } from 'vitest';
import {
  buildPrimaryRoutes,
  getPrimaryRouteKey,
  getPrimaryRouteMeta,
} from './route-meta';

describe('route-meta', () => {
  it('builds the Coral Stay top-level route set in order', () => {
    const koRoutes = buildPrimaryRoutes('ko');
    const enRoutes = buildPrimaryRoutes('en');

    expect(koRoutes.map((route) => route.key)).toEqual([
      'overview',
      'control',
      'trend',
      'crop-work',
      'resources',
      'alerts',
    ]);
    expect(enRoutes.map((route) => route.key)).toEqual(koRoutes.map((route) => route.key));
  });

  it('maps direct and legacy paths to the new top-level route keys', () => {
    expect(getPrimaryRouteKey('/overview')).toBe('overview');
    expect(getPrimaryRouteKey('/control')).toBe('control');
    expect(getPrimaryRouteKey('/trend')).toBe('trend');
    expect(getPrimaryRouteKey('/rtr')).toBe('control');
    expect(getPrimaryRouteKey('/crop-work')).toBe('crop-work');
    expect(getPrimaryRouteKey('/assistant')).toBe('overview');
    expect(getPrimaryRouteKey('/settings')).toBe('overview');

    expect(getPrimaryRouteKey('/growth')).toBe('crop-work');
    expect(getPrimaryRouteKey('/nutrient')).toBe('resources');
    expect(getPrimaryRouteKey('/protection')).toBe('alerts');
    expect(getPrimaryRouteKey('/harvest')).toBe('crop-work');
    expect(getPrimaryRouteKey('/ask')).toBe('overview');
  });

  it('returns localized metadata for the active route', () => {
    expect(getPrimaryRouteMeta('/overview', 'ko').title).toBe('오늘 운영');
    expect(getPrimaryRouteMeta('/trend', 'ko').label).toBe('날씨와 시세');
    expect(getPrimaryRouteMeta('/assistant', 'ko').label).toBe('질문 도우미');
    expect(getPrimaryRouteMeta('/rtr', 'en').title).toBe('Temperature Strategy');
  });
});
