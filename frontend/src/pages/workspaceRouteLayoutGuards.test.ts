import { describe, expect, it } from 'vitest';

import pageCanvasSource from '../components/layout/PageCanvas.tsx?raw';
import assistantPageSource from './assistant-page.tsx?raw';
import assistantRouteSource from './assistant-route-page.tsx?raw';
import controlPageSource from './control-page.tsx?raw';
import cropWorkPageSource from './crop-work-page.tsx?raw';
import cropWorkRouteSource from './crop-work-route-page.tsx?raw';
import rtrPageSource from './rtr-page.tsx?raw';
import rtrRouteSource from './rtr-route-page.tsx?raw';
import scenariosRouteSource from './scenarios-route-page.tsx?raw';
import settingsPageSource from './settings-page.tsx?raw';
import settingsRouteSource from './settings-route-page.tsx?raw';

function getClassNames(source: string) {
  return Array.from(source.matchAll(/className="([^"]+)"/g), (match) => match[1]);
}

function expectClassNamesWithMarkerToInclude(
  source: string,
  marker: string,
  requiredClassName: string,
) {
  const classNames = getClassNames(source).filter((className) => className.includes(marker));

  expect(classNames.length).toBeGreaterThan(0);
  expect(classNames.filter((className) => !className.split(/\s+/).includes(requiredClassName))).toEqual([]);
}

function countOccurrences(source: string, value: string) {
  return source.split(value).length - 1;
}

describe('workspace route layout guards', () => {
  it('keeps independent route canvases shrinkable inside the shell', () => {
    expect(pageCanvasSource).toContain('mx-auto flex w-full min-w-0 max-w-[1320px]');
    expect(rtrPageSource).toContain('mx-auto flex w-full min-w-0 max-w-[1280px]');
    expect(scenariosRouteSource).toContain('mx-auto flex w-full min-w-0 max-w-[1280px]');
  });

  it('uses minmax(0, ...) tracks for fixed workspace column layouts', () => {
    expect(assistantPageSource).toContain('grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,392px)]');
    expect(settingsPageSource).toContain('grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
  });

  it('keeps the RTR route as a single optimizer surface without borrowed tab panels', () => {
    expect(rtrRouteSource).toContain('recommendationSurface');
    expect(rtrRouteSource).not.toContain('supportSurface');
    expect(rtrRouteSource).not.toContain('ControlPanel');
    expect(rtrRouteSource).not.toContain('DecisionSnapshotGrid');
  });

  it('guards all xl column-span route grid items against intrinsic-width overflow', () => {
    expectClassNamesWithMarkerToInclude(controlPageSource, 'xl:col-span', 'min-w-0');
    expectClassNamesWithMarkerToInclude(cropWorkPageSource, 'xl:col-span', 'min-w-0');
  });

  it('keeps nested workspace route surfaces shrinkable', () => {
    expect(countOccurrences(assistantRouteSource, 'className="min-w-0 space-y-6"')).toBe(2);
    expect(cropWorkRouteSource).toContain('min-w-0 space-y-5');
    expect(countOccurrences(scenariosRouteSource, 'className="min-w-0 scroll-mt-24 focus:outline-none"')).toBe(2);
    expect(settingsRouteSource).toContain('grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
  });
});
