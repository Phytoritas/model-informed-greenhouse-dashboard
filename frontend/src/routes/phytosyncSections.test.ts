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

        expect(koSections).toHaveLength(9);
        expect(enSections).toHaveLength(9);
        expect(koSections.map((section) => section.key)).toEqual([
            'overview',
            'control',
            'growth',
            'nutrient',
            'protection',
            'harvest',
            'resources',
            'alerts',
            'ask',
        ]);
        expect(enSections.map((section) => section.key)).toEqual(koSections.map((section) => section.key));
    });

    it('keeps key farmer-facing route metadata aligned', () => {
        const sections = buildPhytoSections('ko');
        const overview = sections.find((section) => section.key === 'overview');
        const harvest = sections.find((section) => section.key === 'harvest');
        const ask = sections.find((section) => section.key === 'ask');
        const growth = sections.find((section) => section.key === 'growth');

        expect(overview?.path).toBe('/overview');
        expect(overview?.workspace).toBe('command');
        expect(overview?.tabs.map((tab) => tab.label)).toEqual(['핵심 판단', '실시간 상태', '오늘 조치']);

        expect(growth?.path).toBe('/growth');
        expect(growth?.workspace).toBe('advisor');
        expect(growth?.advisorTab).toBe('physiology');

        expect(harvest?.path).toBe('/harvest');
        expect(harvest?.workspace).toBe('advisor');
        expect(harvest?.advisorTab).toBe('harvest_market');

        expect(ask?.path).toBe('/ask');
        expect(ask?.workspace).toBe('knowledge');
        expect(ask?.tabs.map((tab) => tab.label)).toEqual(['질문', '자료 찾기', '최근 흐름']);
    });

    it('matches nested paths and falls back to overview on unknown paths', () => {
        const sections = buildPhytoSections('en');

        expect(findPhytoSection(sections, '/harvest/week').key).toBe('harvest');
        expect(findPhytoSection(sections, '/resources/energy').key).toBe('resources');
        expect(findPhytoSection(sections, '/not-a-real-route').key).toBe('overview');
    });

    it('returns stable default section paths for workspace and advisor tab routing', () => {
        expect(getDefaultSectionPathForWorkspace('command')).toBe('/overview');
        expect(getDefaultSectionPathForWorkspace('rtr')).toBe('/control');
        expect(getDefaultSectionPathForWorkspace('crop')).toBe('/growth');
        expect(getDefaultSectionPathForWorkspace('advisor')).toBe('/growth');
        expect(getDefaultSectionPathForWorkspace('resources')).toBe('/resources');
        expect(getDefaultSectionPathForWorkspace('alerts')).toBe('/alerts');
        expect(getDefaultSectionPathForWorkspace('knowledge')).toBe('/ask');

        expect(getSectionPathForAdvisorTab('environment')).toBe('/growth');
        expect(getSectionPathForAdvisorTab('physiology')).toBe('/growth');
        expect(getSectionPathForAdvisorTab('work')).toBe('/growth');
        expect(getSectionPathForAdvisorTab('nutrient')).toBe('/nutrient');
        expect(getSectionPathForAdvisorTab('pesticide')).toBe('/protection');
        expect(getSectionPathForAdvisorTab('harvest_market')).toBe('/harvest');
    });
});
