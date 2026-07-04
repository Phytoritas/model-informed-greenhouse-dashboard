import { describe, expect, it } from 'vitest';
import {
  GLOBAL_NAVIGATION_ITEMS,
  getGlobalNavigationKeyForPathname,
  getSubNavigationSectionKeys,
} from './globalNavigation';

describe('globalNavigation', () => {
  it('verify_src001_s0002_r001_a01 keeps the shared global navigation labels in order', () => {
    expect(GLOBAL_NAVIGATION_ITEMS.map((item) => item.label)).toEqual([
      'HOME',
      'DASHBOARD',
      'INSIGHTS',
      'SCENARIOS',
      'KNOWLEDGE',
      'CONTACT',
    ]);
  });

  it('verify_src001_s0002_r002_a01 keeps the global destinations stable', () => {
    expect(GLOBAL_NAVIGATION_ITEMS.map((item) => [item.label, item.path ?? null])).toEqual([
      ['HOME', '/overview'],
      ['DASHBOARD', '/control'],
      ['INSIGHTS', '/trend'],
      ['SCENARIOS', '/scenarios'],
      ['KNOWLEDGE', '/assistant'],
      ['CONTACT', null],
    ]);
  });

  it('verify_src001_s0002_r003_a01 maps paths to category-specific subtabs', () => {
    expect(getGlobalNavigationKeyForPathname('/control')).toBe('dashboard');
    expect(getGlobalNavigationKeyForPathname('/rtr')).toBe('dashboard');
    expect(getGlobalNavigationKeyForPathname('/crop-work')).toBe('dashboard');
    expect(getGlobalNavigationKeyForPathname('/resources')).toBe('dashboard');
    expect(getGlobalNavigationKeyForPathname('/alerts')).toBe('dashboard');
    expect(getGlobalNavigationKeyForPathname('/trend')).toBe('insights');
    expect(getGlobalNavigationKeyForPathname('/scenarios')).toBe('scenarios');
    expect(getGlobalNavigationKeyForPathname('/assistant')).toBe('knowledge');
    expect(getGlobalNavigationKeyForPathname('/settings')).toBeNull();

    expect(getSubNavigationSectionKeys('dashboard')).toEqual([
      'control',
      'rtr',
      'crop-work',
      'resources',
      'alerts',
    ]);
    expect(getSubNavigationSectionKeys('insights')).toEqual(['trend']);
    expect(getSubNavigationSectionKeys('scenarios')).toEqual(['scenarios']);
    expect(getSubNavigationSectionKeys('knowledge')).toEqual(['assistant']);
    expect(getSubNavigationSectionKeys(null)).toEqual([]);
  });
});
