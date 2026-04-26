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

  it('keeps restored feature routes visible in the workspace navigation', () => {
    const visibleRoutes = buildPrimaryRoutes('en').map((route) => route.key);

    expect(visibleRoutes).toEqual([
      'overview',
      'control',
      'rtr',
      'scenarios',
      'trend',
      'crop-work',
      'resources',
      'alerts',
      'assistant',
      'settings',
    ]);
    expect(getPrimaryRouteKey('/rtr')).toBe('rtr');
    expect(getPrimaryRouteKey('/scenarios')).toBe('scenarios');
    expect(getPrimaryRouteKey('/assistant')).toBe('assistant');
    expect(getPrimaryRouteKey('/settings')).toBe('settings');
  });
});
