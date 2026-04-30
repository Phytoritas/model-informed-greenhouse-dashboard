import { describe, expect, it } from 'vitest';
import { buildPrimaryRoutes, getPrimaryRouteKey } from './route-meta';
import {
  BACKEND_INTEGRATION_INVENTORY,
  REQUIRED_BACKEND_ENDPOINTS,
} from './backend-integration-inventory';

describe('backend integration inventory', () => {
  it('keeps required backend surfaces represented by a frontend route or panel', () => {
    const endpoints = new Set(BACKEND_INTEGRATION_INVENTORY.map((entry) => entry.endpoint));

    for (const endpoint of REQUIRED_BACKEND_ENDPOINTS) {
      expect(endpoints.has(endpoint), endpoint).toBe(true);
    }

    expect(
      BACKEND_INTEGRATION_INVENTORY.filter((entry) => {
        const status = String(entry.status);
        return status === 'missing' || status === 'disconnected';
      }),
    ).toEqual([]);
  });

  it('keeps restored feature routes visible without duplicating RTR as a top-level nav item', () => {
    const visibleRoutes = buildPrimaryRoutes('en').map((route) => route.key);

    expect(visibleRoutes).toEqual([
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
    expect(getPrimaryRouteKey('/rtr')).toBe('control');
    expect(getPrimaryRouteKey('/dashboard')).toBe('control');
    expect(getPrimaryRouteKey('/scenarios')).toBe('scenarios');
    expect(getPrimaryRouteKey('/assistant')).toBe('assistant');
    expect(getPrimaryRouteKey('/settings')).toBe('settings');
  });

  it('documents compatibility endpoints that are intentionally surfaced through delegated advisor tabs', () => {
    const byEndpoint = new Map(BACKEND_INTEGRATION_INVENTORY.map((entry) => [entry.endpoint, entry]));

    const delegatedEndpoints = [
      '/api/advisor/environment',
      '/api/advisor/physiology',
      '/api/advisor/work-tradeoff',
      '/api/advisor/harvest',
      '/api/environment/recommend',
      '/api/work/recommend',
      '/api/pesticides/recommend',
      '/api/nutrients/recommend',
      '/api/nutrients/correction',
    ] as const;

    for (const endpoint of delegatedEndpoints) {
      expect(byEndpoint.get(endpoint)?.status, endpoint).toBe('hidden');
    }
    expect(byEndpoint.get('/api/nutrients/correction')?.frontend).toBe('useSmartGrowAdvisor.runCorrection nested tool');
  });
});
