import { describe, expect, it } from 'vitest';
import {
  buildPhytoSections,
  findPhytoSection,
  getDefaultSectionPathForWorkspace,
  getSectionPathForAdvisorTab,
} from './phytosyncSections';

describe('phytosyncSections', () => {
  it('builds the full section set for Korean and English', () => {
    const koSections = buildPhytoSections('ko');
    const enSections = buildPhytoSections('en');

    expect(koSections).toHaveLength(10);
    expect(enSections).toHaveLength(10);
    expect(koSections.map((section) => section.key)).toEqual([
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
    expect(enSections.map((section) => section.key)).toEqual(koSections.map((section) => section.key));
  });

  it('keeps key farmer-facing route metadata aligned', () => {
    const koSections = buildPhytoSections('ko');
    const enSections = buildPhytoSections('en');
    const overview = koSections.find((section) => section.key === 'overview');
    const control = koSections.find((section) => section.key === 'control');
    const rtr = koSections.find((section) => section.key === 'rtr');
    const scenarios = koSections.find((section) => section.key === 'scenarios');
    const cropWork = koSections.find((section) => section.key === 'crop-work');
    const resources = koSections.find((section) => section.key === 'resources');
    const alerts = koSections.find((section) => section.key === 'alerts');
    const assistant = koSections.find((section) => section.key === 'assistant');
    const settings = koSections.find((section) => section.key === 'settings');
    const enOverview = enSections.find((section) => section.key === 'overview');
    const enControl = enSections.find((section) => section.key === 'control');
    const enRtr = enSections.find((section) => section.key === 'rtr');
    const enScenarios = enSections.find((section) => section.key === 'scenarios');
    const enTrend = enSections.find((section) => section.key === 'trend');
    const enResources = enSections.find((section) => section.key === 'resources');
    const enAssistant = enSections.find((section) => section.key === 'assistant');

    expect(overview?.path).toBe('/overview');
    expect(overview?.workspace).toBe('command');
    expect(overview?.tabs.map((tab) => tab.label)).toEqual(['오늘 판단', '전체 지표', '주의 확인']);

    expect(control?.path).toBe('/control');
    expect(control?.workspace).toBe('rtr');
    expect(control?.advisorTab).toBe('environment');
    expect(control?.tabs.map((tab) => tab.label)).toEqual(['환경 솔루션', '장치 상태', '구동 제어']);

    expect(rtr?.path).toBe('/rtr');
    expect(rtr?.workspace).toBe('rtr');
    expect(rtr?.tabs.map((tab) => tab.id)).toEqual(['rtr-strategy', 'rtr-sensitivity', 'rtr-area']);

    expect(scenarios?.path).toBe('/scenarios');
    expect(scenarios?.workspace).toBe('rtr');
    expect(scenarios?.tabs.map((tab) => tab.id)).toEqual(['scenario-model', 'scenario-rtr']);

    expect(cropWork?.path).toBe('/crop-work');
    expect(cropWork?.workspace).toBe('crop');
    expect(cropWork?.advisorTab).toBe('physiology');

    expect(resources?.path).toBe('/resources');
    expect(resources?.workspace).toBe('resources');
    expect(resources?.advisorTab).toBe('nutrient');

    expect(alerts?.path).toBe('/alerts');
    expect(alerts?.workspace).toBe('alerts');
    expect(alerts?.advisorTab).toBe('pesticide');

    expect(assistant?.path).toBe('/assistant');
    expect(assistant?.workspace).toBe('knowledge');
    expect(assistant?.tabs.map((tab) => tab.id)).toEqual(['assistant-chat', 'assistant-search', 'assistant-solutions']);
    expect(assistant?.tabs.map((tab) => tab.label)).toEqual(['질문', '자료 찾기', '솔루션']);

    expect(settings?.path).toBe('/settings');
    expect(settings?.workspace).toBe('settings');

    expect(enOverview?.tabs.map((tab) => tab.label)).toEqual(['Operations', 'Dashboard', 'Watch']);
    expect(enControl?.tabs.map((tab) => tab.label)).toEqual(['Climate solutions', 'Devices', 'Runtime']);
    expect(enRtr?.tabs.map((tab) => tab.label)).toEqual(['Strategy', 'Sensitivity', 'Area']);
    expect(enScenarios?.tabs.map((tab) => tab.label)).toEqual(['Adjustment effect', 'RTR sensitivity']);
    expect(enTrend?.tabs.map((tab) => tab.label)).toEqual(['Weather chart', 'Market chart', 'Decision signals']);
    expect(enResources?.tabs.map((tab) => tab.label)).toEqual(['Nutrients', 'Energy', 'Market']);
    expect(enAssistant?.tabs.map((tab) => tab.label)).toEqual(['Ask', 'Materials', 'Solutions']);
  });

  it('matches nested paths, keeps /ask as an alias, and falls back to overview on unknown paths', () => {
    const sections = buildPhytoSections('en');

    expect(findPhytoSection(sections, '/rtr').key).toBe('control');
    expect(findPhytoSection(sections, '/dashboard').key).toBe('control');
    expect(findPhytoSection(sections, '/scenarios').key).toBe('scenarios');
    expect(findPhytoSection(sections, '/harvest/week').key).toBe('crop-work');
    expect(findPhytoSection(sections, '/resources/energy').key).toBe('resources');
    expect(findPhytoSection(sections, '/assistant').key).toBe('assistant');
    expect(findPhytoSection(sections, '/ask').key).toBe('assistant');
    expect(findPhytoSection(sections, '/settings').key).toBe('settings');
    expect(findPhytoSection(sections, '/not-a-real-route').key).toBe('overview');
  });

  it('returns stable default section paths for workspace and advisor tab routing', () => {
    expect(getDefaultSectionPathForWorkspace('command')).toBe('/overview');
    expect(getDefaultSectionPathForWorkspace('rtr')).toBe('/control#control-strategy');
    expect(getDefaultSectionPathForWorkspace('trend')).toBe('/trend');
    expect(getDefaultSectionPathForWorkspace('crop')).toBe('/crop-work');
    expect(getDefaultSectionPathForWorkspace('advisor')).toBe('/crop-work');
    expect(getDefaultSectionPathForWorkspace('resources')).toBe('/resources');
    expect(getDefaultSectionPathForWorkspace('alerts')).toBe('/alerts');
    expect(getDefaultSectionPathForWorkspace('knowledge')).toBe('/knowledge#assistant-search');
    expect(getDefaultSectionPathForWorkspace('settings')).toBe('/settings');

    expect(getSectionPathForAdvisorTab('environment')).toBe('/control#control-strategy');
    expect(getSectionPathForAdvisorTab('physiology')).toBe('/crop-work#crop-work-growth');
    expect(getSectionPathForAdvisorTab('work')).toBe('/crop-work#crop-work-work');
    expect(getSectionPathForAdvisorTab('nutrient')).toBe('/resources#resources-nutrient');
    expect(getSectionPathForAdvisorTab('pesticide')).toBe('/alerts#alerts-protection');
    expect(getSectionPathForAdvisorTab('harvest_market')).toBe('/crop-work#crop-work-harvest');
  });
});
