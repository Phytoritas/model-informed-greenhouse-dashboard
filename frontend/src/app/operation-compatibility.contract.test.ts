import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKEND_INTEGRATION_INVENTORY,
  REQUIRED_BACKEND_ENDPOINTS,
} from './backend-integration-inventory';
import { COMMAND_DESIGN_PARITY_CONTRACT } from './commandDesignParity';
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

const REQUIRED_REPOSITORY_IGNORE_PATTERNS = [
  'docs/',
  'screenshots/',
  '*.screenshot.png',
  '*.screenshot.jpg',
  '*.screenshot.jpeg',
  '.rah/',
] as const;

const R27_PHASE_FILE_LIMIT = 5;

function runGit(args: string[]): string {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).replace(/\r\n/g, '\n').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitGitLines(value: string): string[] {
  return value ? value.split('\n').filter(Boolean) : [];
}

function isRepositoryArtifactPath(value: string): boolean {
  return (
    value.startsWith('docs/')
    || value.startsWith('screenshots/')
    || value.startsWith('.rah/')
    || /\.(?:screenshot\.(?:png|jpe?g))$/i.test(value)
  );
}

function assertNoBackendHookOrRouteDrift({
  requiredEndpoints,
  connectedEndpoints,
  routeContracts,
  inventory,
}: {
  requiredEndpoints: readonly string[];
  connectedEndpoints: readonly string[];
  routeContracts: readonly { key: string; path: string }[];
  inventory: readonly { frontend: string; route: string }[];
}) {
  expect([...requiredEndpoints]).toEqual([...EXPECTED_REQUIRED_BACKEND_ENDPOINTS]);
  expect(connectedEndpoints).toEqual([...EXPECTED_CONNECTED_BACKEND_ENDPOINTS]);
  expect(routeContracts).toEqual([...EXPECTED_PRIMARY_ROUTE_CONTRACTS]);
  expect(inventory.every((entry) => Boolean(entry.frontend.trim() && entry.route.trim()))).toBe(true);
}

function assertNoPacingNavTrendOrCommandParityRegression({
  pacePresets,
  defaultPace,
  cucumberPaceRequest,
  tomatoDefaultPaceRequest,
  trendRoute,
  trendRouteKey,
  nestedTrendRouteKey,
  trendSectionKey,
  nestedTrendSectionKey,
  defaultTrendPath,
  commandParity,
}: {
  pacePresets: readonly number[];
  defaultPace: number;
  cucumberPaceRequest: { path: string; init: RequestInit };
  tomatoDefaultPaceRequest: { path: string; init: RequestInit };
  trendRoute: { key?: string; path?: string; label?: string; visibleInNav?: boolean } | undefined;
  trendRouteKey: string;
  nestedTrendRouteKey: string;
  trendSectionKey: string;
  nestedTrendSectionKey: string;
  defaultTrendPath: string;
  commandParity: {
    issueId: string;
    paritySurfaces: readonly {
      path?: string;
      tab?: string;
      panel?: string;
      marker: string;
    }[];
    designLanguage: {
      requiredClasses: readonly string[];
      sharedComponents: readonly string[];
      statusChipTones: readonly string[];
    };
  };
}) {
  expect(pacePresets).toEqual([10, 20, 30, 60, 600, 6000]);
  expect(defaultPace).toBe(600);
  expect(cucumberPaceRequest.path).toBe('/speed?crop=cucumber');
  expect(cucumberPaceRequest.init.method).toBe('POST');
  expect(cucumberPaceRequest.init.headers).toEqual({ 'Content-Type': 'application/json' });
  expect(JSON.parse(String(cucumberPaceRequest.init.body))).toEqual({
    sim_seconds_per_real_second: 6000,
    speed: 1,
  });
  expect(tomatoDefaultPaceRequest.path).toBe('/speed?crop=tomato');
  expect(JSON.parse(String(tomatoDefaultPaceRequest.init.body))).toEqual({
    sim_seconds_per_real_second: 600,
    speed: 0.1,
  });

  expect(trendRoute).toMatchObject({
    key: 'trend',
    path: '/trend',
    label: 'Trend',
    visibleInNav: true,
  });
  expect(trendRouteKey).toBe('trend');
  expect(nestedTrendRouteKey).toBe('trend');
  expect(trendSectionKey).toBe('trend');
  expect(nestedTrendSectionKey).toBe('trend');
  expect(defaultTrendPath).toBe('/trend');

  expect(commandParity.issueId).toBe('#133');
  expect(commandParity.paritySurfaces).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: '/overview', tab: 'Dashboard', marker: 'overview-dashboard' }),
      expect.objectContaining({ path: '/overview', tab: 'Watch', marker: 'overview-watch' }),
      expect.objectContaining({ path: '/trend', panel: 'WeatherTrendPanel', marker: 'trend-weather' }),
      expect.objectContaining({ path: '/trend', panel: 'WeatherOutlookPanel', marker: 'trend-weather' }),
      expect.objectContaining({ path: '/trend', panel: 'ProducePricesPanel', marker: 'trend-market' }),
      expect.objectContaining({ path: '/trend', panel: 'DecisionSnapshotGrid', marker: 'trend-decision' }),
    ]),
  );
  expect(commandParity.designLanguage.requiredClasses).toEqual(['sg-data-number', 'sg-eyebrow']);
  expect(commandParity.designLanguage.sharedComponents).toEqual([
    'DashboardCard',
    'MetricCard',
    'SectionHeader',
    'StatusChip',
  ]);
  expect(commandParity.designLanguage.statusChipTones).toEqual([
    'growth',
    'stable',
    'warning',
    'critical',
    'muted',
  ]);
}

function assertRepositoryPhaseContract({
  gitignore,
  ignoredPaths,
  trackedRepositoryArtifacts,
  changedFiles,
}: {
  gitignore: string;
  ignoredPaths: readonly { path: string; ignoredAs: string }[];
  trackedRepositoryArtifacts: readonly string[];
  changedFiles: readonly string[];
}) {
  for (const pattern of REQUIRED_REPOSITORY_IGNORE_PATTERNS) {
    expect(gitignore).toMatch(new RegExp(`^${escapeRegExp(pattern)}$`, 'm'));
  }

  for (const { path, ignoredAs } of ignoredPaths) {
    expect(ignoredAs).toBe(path);
  }

  expect(trackedRepositoryArtifacts).toEqual([]);
  expect(changedFiles.length).toBeLessThanOrEqual(R27_PHASE_FILE_LIMIT);
  expect(changedFiles.filter(isRepositoryArtifactPath)).toEqual([]);
}

describe('PRD-008 operation compatibility contracts', () => {
  it('verify_src001_s0008_r001_a01 keeps backend APIs, data hook surfaces, and route paths unchanged', () => {
    const enRoutes = buildPrimaryRoutes('en').map(({ key, path }) => ({ key, path }));
    const koRoutes = buildPrimaryRoutes('ko').map(({ key, path }) => ({ key, path }));

    const contract = {
      requiredEndpoints: REQUIRED_BACKEND_ENDPOINTS,
      connectedEndpoints: BACKEND_INTEGRATION_INVENTORY.map(({ endpoint }) => endpoint),
      routeContracts: enRoutes,
      inventory: BACKEND_INTEGRATION_INVENTORY,
    };

    assertNoBackendHookOrRouteDrift(contract);
    assertNoBackendHookOrRouteDrift({ ...contract, routeContracts: koRoutes });

    expect(() => assertNoBackendHookOrRouteDrift({
      ...contract,
      requiredEndpoints: REQUIRED_BACKEND_ENDPOINTS.filter((endpoint) => endpoint !== '/api/status'),
    })).toThrow();
    expect(() => assertNoBackendHookOrRouteDrift({
      ...contract,
      connectedEndpoints: BACKEND_INTEGRATION_INVENTORY
        .map(({ endpoint }) => endpoint)
        .filter((endpoint) => endpoint !== '/api/weather/daegu'),
    })).toThrow();
    expect(() => assertNoBackendHookOrRouteDrift({
      ...contract,
      routeContracts: enRoutes.map((route) => route.key === 'trend'
        ? { ...route, path: '/weather' }
        : route),
    })).toThrow();
    expect(() => assertNoBackendHookOrRouteDrift({
      ...contract,
      inventory: BACKEND_INTEGRATION_INVENTORY.map((entry, index) => index === 0
        ? { ...entry, frontend: '' }
        : entry),
    })).toThrow();
  });

  it('verify_src001_s0008_r002_a01 preserves issue #131 pacing, issue #132 nav/trend, and issue #133 Command parity', () => {
    const cucumberPaceRequest = buildSimulationPaceRequest('Cucumber', 6000);
    const tomatoDefaultPaceRequest = buildSimulationPaceRequest('Tomato', DEFAULT_SIMULATION_PACE);
    const sections = buildPhytoSections('en');
    const trendRoute = buildPrimaryRoutes('en').find((route) => route.key === 'trend');

    const contract = {
      pacePresets: simulationRuntimePacePresets,
      defaultPace: DEFAULT_SIMULATION_PACE,
      cucumberPaceRequest,
      tomatoDefaultPaceRequest,
      trendRoute,
      trendRouteKey: getPrimaryRouteKey('/trend'),
      nestedTrendRouteKey: getPrimaryRouteKey('/trend/legacy'),
      trendSectionKey: findPhytoSection(sections, '/trend').key,
      nestedTrendSectionKey: findPhytoSection(sections, '/trend/legacy').key,
      defaultTrendPath: getDefaultSectionPathForWorkspace('trend'),
      commandParity: COMMAND_DESIGN_PARITY_CONTRACT,
    };

    assertNoPacingNavTrendOrCommandParityRegression(contract);

    expect(() => assertNoPacingNavTrendOrCommandParityRegression({
      ...contract,
      pacePresets: [10, 20, 30, 60, 600],
    })).toThrow();
    expect(() => assertNoPacingNavTrendOrCommandParityRegression({
      ...contract,
      trendRoute: { ...trendRoute, path: '/weather' },
    })).toThrow();
    expect(() => assertNoPacingNavTrendOrCommandParityRegression({
      ...contract,
      defaultTrendPath: '/overview',
    })).toThrow();
    expect(() => assertNoPacingNavTrendOrCommandParityRegression({
      ...contract,
      commandParity: {
        ...COMMAND_DESIGN_PARITY_CONTRACT,
        paritySurfaces: COMMAND_DESIGN_PARITY_CONTRACT.paritySurfaces.filter(
          (surface) => !('path' in surface && surface.path === '/trend'),
        ),
      },
    })).toThrow();
    expect(() => assertNoPacingNavTrendOrCommandParityRegression({
      ...contract,
      commandParity: {
        ...COMMAND_DESIGN_PARITY_CONTRACT,
        designLanguage: {
          ...COMMAND_DESIGN_PARITY_CONTRACT.designLanguage,
          requiredClasses: ['sg-eyebrow'],
        },
      },
    })).toThrow();
  });

  it('verify_src001_s0008_r003_a01 keeps each phase within five files and excludes docs, screenshots, and .rah artifacts', () => {
    const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');
    const ignoredPaths = [
      'docs/prd-008.md',
      'screenshots/prd-008.png',
      '.rah/prd-008/state.json',
      'artifacts/prd-008/report.json',
      'out/prd-008/smoke.log',
      'runs-prd-008/output.log',
      'frontend/src/app/prd-008.screenshot.png',
    ].map((ignoredPath) => ({
      path: ignoredPath,
      ignoredAs: runGit(['check-ignore', ignoredPath]),
    }));
    const trackedRepositoryArtifacts = splitGitLines(runGit([
      'ls-files',
      '--',
      'docs',
      'screenshots',
      '.rah',
      '*.screenshot.png',
      '*.screenshot.jpg',
      '*.screenshot.jpeg',
    ]));
    const changedFiles = splitGitLines(runGit(['diff', '--name-only', 'HEAD', '--']));

    const contract = {
      gitignore,
      ignoredPaths,
      trackedRepositoryArtifacts,
      changedFiles,
    };

    assertRepositoryPhaseContract(contract);

    expect(() => assertRepositoryPhaseContract({
      ...contract,
      gitignore: gitignore.replace(/^\.rah\/\r?\n/m, ''),
    })).toThrow();
    expect(() => assertRepositoryPhaseContract({
      ...contract,
      trackedRepositoryArtifacts: ['docs/prd-008.md'],
    })).toThrow();
    expect(() => assertRepositoryPhaseContract({
      ...contract,
      changedFiles: [
        'frontend/src/app/one.ts',
        'frontend/src/app/two.ts',
        'frontend/src/app/three.ts',
        'frontend/src/app/four.ts',
        'frontend/src/app/five.ts',
        'frontend/src/app/six.ts',
      ],
    })).toThrow();
    expect(() => assertRepositoryPhaseContract({
      ...contract,
      changedFiles: ['.rah/prd-008/state.json'],
    })).toThrow();
  });
});
