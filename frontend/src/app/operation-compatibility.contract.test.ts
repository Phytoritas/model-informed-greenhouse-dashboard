import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKEND_INTEGRATION_INVENTORY,
  REQUIRED_BACKEND_ENDPOINTS,
} from './backend-integration-inventory';
import { buildPrimaryRoutes, getPrimaryRouteKey } from './route-meta';
import {
  buildPhytoSections,
  findPhytoSection,
  getDefaultSectionPathForWorkspace,
} from '../routes/phytosyncSections';
import {
  buildSimulationPaceRequest,
  DEFAULT_SIMULATION_PACE,
  simulationRuntimePacePresets,
} from '../hooks/useSimulationRuntimeControls';

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: process.cwd(),
  encoding: 'utf8',
}).trim();

const EXPECTED_REQUIRED_BACKEND_ENDPOINTS = [
  '/api/status',
  '/api/start',
  '/api/step',
  '/api/run',
  '/api/pause',
  '/api/resume',
  '/api/stop',
  '/api/speed',
  '/ws/sim/{crop}',
  '/ws/forecast/{crop}',
  '/api/config/ops',
  '/api/config/crop',
  '/api/settings',
  '/api/feedback',
  '/api/rtr/profiles',
  '/api/rtr/state',
  '/api/rtr/optimize',
  '/api/rtr/scenario',
  '/api/rtr/sensitivity',
  '/api/rtr/area-settings',
  '/api/models/snapshot',
  '/api/models/replay',
  '/api/models/scenario',
  '/api/models/sensitivity',
  '/api/advisor/summary',
  '/api/advisor/tab/{tab_name}',
  '/api/advisor/chat',
  '/api/advisor/environment',
  '/api/advisor/physiology',
  '/api/advisor/work-tradeoff',
  '/api/advisor/harvest',
  '/api/environment/recommend',
  '/api/work/recommend',
  '/api/knowledge/status',
  '/api/knowledge/reindex',
  '/api/knowledge/query',
  '/api/pesticides/recommend',
  '/api/nutrients/recommend',
  '/api/nutrients/correction',
  '/api/weather/daegu',
  '/api/market/produce',
  '/api/ai/consult',
  '/api/ai/chat',
] as const;

const EXPECTED_CONNECTED_BACKEND_ENDPOINTS = [
  '/api/status',
  '/api/start',
  '/api/step',
  '/api/run',
  '/api/pause',
  '/api/resume',
  '/api/stop',
  '/api/speed',
  '/ws/sim/{crop}',
  '/ws/forecast/{crop}',
  '/api/forecast/{crop}',
  '/api/config/ops',
  '/api/config/crop',
  '/api/settings',
  '/api/feedback',
  '/api/rtr/profiles',
  '/api/rtr/state',
  '/api/rtr/optimize',
  '/api/rtr/scenario',
  '/api/rtr/sensitivity',
  '/api/rtr/area-settings',
  '/api/models/snapshot',
  '/api/models/replay',
  '/api/models/scenario',
  '/api/models/sensitivity',
  '/api/advisor/summary',
  '/api/advisor/tab/{tab_name}',
  '/api/advisor/chat',
  '/api/advisor/environment',
  '/api/advisor/physiology',
  '/api/advisor/work-tradeoff',
  '/api/advisor/harvest',
  '/api/environment/recommend',
  '/api/work/recommend',
  '/api/knowledge/status',
  '/api/knowledge/reindex',
  '/api/knowledge/query',
  '/api/pesticides/recommend',
  '/api/nutrients/recommend',
  '/api/nutrients/correction',
  '/api/weather/daegu',
  '/api/market/produce',
  '/api/ai/consult',
  '/api/ai/chat',
] as const;

const EXPECTED_PRIMARY_ROUTE_CONTRACTS = [
  { key: 'overview', path: '/overview' },
  { key: 'control', path: '/control' },
  { key: 'rtr', path: '/rtr' },
  { key: 'scenarios', path: '/scenarios' },
  { key: 'trend', path: '/trend' },
  { key: 'crop-work', path: '/crop-work' },
  { key: 'resources', path: '/resources' },
  { key: 'alerts', path: '/alerts' },
  { key: 'assistant', path: '/assistant' },
  { key: 'settings', path: '/settings' },
] as const;

function runGit(args: string[]): string {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).replace(/\r\n/g, '\n').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('PRD-008 operation compatibility contracts', () => {
  it('verify_src001_s0008_r001_a01 keeps backend APIs, data hook surfaces, and route paths unchanged', () => {
    expect([...REQUIRED_BACKEND_ENDPOINTS]).toEqual([...EXPECTED_REQUIRED_BACKEND_ENDPOINTS]);
    expect(BACKEND_INTEGRATION_INVENTORY.map(({ endpoint, status }) => ({ endpoint, status }))).toEqual(
      EXPECTED_CONNECTED_BACKEND_ENDPOINTS.map((endpoint) => ({ endpoint, status: 'connected' })),
    );
    expect(BACKEND_INTEGRATION_INVENTORY.every((entry) => Boolean(entry.frontend.trim() && entry.route.trim()))).toBe(true);

    const enRoutes = buildPrimaryRoutes('en').map(({ key, path }) => ({ key, path }));
    const koRoutes = buildPrimaryRoutes('ko').map(({ key, path }) => ({ key, path }));

    expect(enRoutes).toEqual([...EXPECTED_PRIMARY_ROUTE_CONTRACTS]);
    expect(koRoutes).toEqual([...EXPECTED_PRIMARY_ROUTE_CONTRACTS]);
  });

  it('verify_src001_s0008_r002_a01 keeps docs and screenshots ignored rather than tracked', () => {
    const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');

    for (const pattern of [
      'docs/',
      'screenshots/',
      '*.screenshot.png',
      '*.screenshot.jpg',
      '*.screenshot.jpeg',
    ]) {
      expect(gitignore).toMatch(new RegExp(`^${escapeRegExp(pattern)}$`, 'm'));
    }

    for (const ignoredPath of [
      'docs/prd-008.md',
      'screenshots/prd-008.png',
      'artifacts/prd-008/report.json',
      'out/prd-008/smoke.log',
      'runs-prd-008/output.log',
      'frontend/src/app/prd-008.screenshot.png',
    ]) {
      expect(runGit(['check-ignore', ignoredPath])).toBe(ignoredPath);
    }

    expect(runGit([
      'ls-files',
      '--',
      'docs',
      'screenshots',
      '*.screenshot.png',
      '*.screenshot.jpg',
      '*.screenshot.jpeg',
    ])).toBe('');
  });

  it('verify_src001_s0008_r003_a01 preserves issue #131 pacing controls and issue #132 /trend routing', () => {
    expect(simulationRuntimePacePresets).toEqual([10, 20, 30, 60, 600, 6000]);
    expect(DEFAULT_SIMULATION_PACE).toBe(600);

    const cucumberPaceRequest = buildSimulationPaceRequest('Cucumber', 6000);
    expect(cucumberPaceRequest.path).toBe('/speed?crop=cucumber');
    expect(cucumberPaceRequest.init.method).toBe('POST');
    expect(cucumberPaceRequest.init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(cucumberPaceRequest.init.body))).toEqual({
      sim_seconds_per_real_second: 6000,
      speed: 1,
    });

    const tomatoDefaultPaceRequest = buildSimulationPaceRequest('Tomato', DEFAULT_SIMULATION_PACE);
    expect(tomatoDefaultPaceRequest.path).toBe('/speed?crop=tomato');
    expect(JSON.parse(String(tomatoDefaultPaceRequest.init.body))).toEqual({
      sim_seconds_per_real_second: 600,
      speed: 0.1,
    });

    const sections = buildPhytoSections('en');
    const trendRoute = buildPrimaryRoutes('en').find((route) => route.key === 'trend');

    expect(trendRoute).toMatchObject({
      key: 'trend',
      path: '/trend',
      label: 'Trend',
      visibleInNav: true,
    });
    expect(getPrimaryRouteKey('/trend')).toBe('trend');
    expect(getPrimaryRouteKey('/trend/legacy')).toBe('trend');
    expect(findPhytoSection(sections, '/trend').key).toBe('trend');
    expect(findPhytoSection(sections, '/trend/legacy').key).toBe('trend');
    expect(getDefaultSectionPathForWorkspace('trend')).toBe('/trend');
  });
});
