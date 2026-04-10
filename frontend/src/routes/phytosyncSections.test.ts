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

        expect(koSections).toHaveLength(6);
        expect(enSections).toHaveLength(6);
        expect(koSections.map((section) => section.key)).toEqual([
            'overview',
            'control',
            'crop-work',
            'resources',
            'alerts',
            'assistant',
        ]);
        expect(enSections.map((section) => section.key)).toEqual(koSections.map((section) => section.key));
    });

    it('keeps key farmer-facing route metadata aligned', () => {
        const sections = buildPhytoSections('ko');
        const overview = sections.find((section) => section.key === 'overview');
        const cropWork = sections.find((section) => section.key === 'crop-work');
        const resources = sections.find((section) => section.key === 'resources');
        const alerts = sections.find((section) => section.key === 'alerts');
        const assistant = sections.find((section) => section.key === 'assistant');

        expect(overview?.path).toBe('/overview');
        expect(overview?.workspace).toBe('command');
        expect(overview?.tabs.map((tab) => tab.label)).toEqual(['핵심', '오늘 할 일', '주의']);

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
        expect(assistant?.tabs.map((tab) => tab.id)).toEqual(['assistant-chat', 'assistant-search', 'assistant-history']);
        expect(assistant?.tabs.map((tab) => tab.label)).toEqual(['질문', '자료 찾기', '최근 흐름']);
    });

    it('matches nested paths, keeps /ask as an alias, and falls back to overview on unknown paths', () => {
        const sections = buildPhytoSections('en');

        expect(findPhytoSection(sections, '/rtr').key).toBe('control');
        expect(findPhytoSection(sections, '/harvest/week').key).toBe('crop-work');
        expect(findPhytoSection(sections, '/resources/energy').key).toBe('resources');
        expect(findPhytoSection(sections, '/assistant').key).toBe('assistant');
        expect(findPhytoSection(sections, '/ask').key).toBe('assistant');
        expect(findPhytoSection(sections, '/not-a-real-route').key).toBe('overview');
    });

    it('returns stable default section paths for workspace and advisor tab routing', () => {
        expect(getDefaultSectionPathForWorkspace('command')).toBe('/overview');
        expect(getDefaultSectionPathForWorkspace('rtr')).toBe('/control');
        expect(getDefaultSectionPathForWorkspace('crop')).toBe('/crop-work');
        expect(getDefaultSectionPathForWorkspace('advisor')).toBe('/crop-work');
        expect(getDefaultSectionPathForWorkspace('resources')).toBe('/resources');
        expect(getDefaultSectionPathForWorkspace('alerts')).toBe('/alerts');
        expect(getDefaultSectionPathForWorkspace('knowledge')).toBe('/assistant');

        expect(getSectionPathForAdvisorTab('environment')).toBe('/control#control-strategy');
        expect(getSectionPathForAdvisorTab('physiology')).toBe('/crop-work#crop-work-growth');
        expect(getSectionPathForAdvisorTab('work')).toBe('/crop-work#crop-work-work');
        expect(getSectionPathForAdvisorTab('nutrient')).toBe('/resources#resources-nutrient');
        expect(getSectionPathForAdvisorTab('pesticide')).toBe('/alerts#alerts-warning');
        expect(getSectionPathForAdvisorTab('harvest_market')).toBe('/crop-work#crop-work-harvest');
    });
});
