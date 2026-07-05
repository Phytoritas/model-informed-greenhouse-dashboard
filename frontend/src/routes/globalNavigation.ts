import type { PhytoSectionKey } from './phytosyncSections';

export type GlobalNavigationKey =
  | 'home'
  | 'dashboard'
  | 'insights'
  | 'scenarios'
  | 'knowledge'
  | 'contact';

export interface GlobalNavigationItem {
  key: GlobalNavigationKey;
  label: string;
  path: string;
}

export const GLOBAL_NAVIGATION_ITEMS: readonly GlobalNavigationItem[] = [
  { key: 'home', label: 'HOME', path: '/overview' },
  { key: 'dashboard', label: 'DASHBOARD', path: '/control' },
  { key: 'insights', label: 'INSIGHTS', path: '/trend' },
  { key: 'scenarios', label: 'SCENARIOS', path: '/scenarios' },
  { key: 'knowledge', label: 'KNOWLEDGE', path: '/assistant' },
  { key: 'contact', label: 'CONTACT', path: '/contact' },
] as const;

const DASHBOARD_SUBNAV_SECTION_KEYS = [
  'control',
  'rtr',
  'crop-work',
  'resources',
  'alerts',
] as const satisfies readonly PhytoSectionKey[];

const SUBNAV_SECTION_KEYS_BY_GLOBAL_KEY: Record<GlobalNavigationKey, readonly PhytoSectionKey[]> = {
  home: [],
  dashboard: DASHBOARD_SUBNAV_SECTION_KEYS,
  insights: ['trend'],
  scenarios: ['scenarios'],
  knowledge: ['assistant'],
  contact: [],
};

export function getGlobalNavigationKeyForPathname(pathname: string): GlobalNavigationKey | null {
  if (pathname === '/' || pathname.startsWith('/overview')) return 'home';
  if (pathname.startsWith('/trend')) return 'insights';
  if (pathname.startsWith('/scenarios')) return 'scenarios';
  if (pathname.startsWith('/assistant') || pathname.startsWith('/ask')) return 'knowledge';
  if (pathname.startsWith('/contact')) return 'contact';

  if (
    pathname.startsWith('/control')
    || pathname.startsWith('/rtr')
    || pathname.startsWith('/crop-work')
    || pathname.startsWith('/resources')
    || pathname.startsWith('/alerts')
    || pathname.startsWith('/growth')
    || pathname.startsWith('/harvest')
    || pathname.startsWith('/nutrient')
    || pathname.startsWith('/protection')
  ) {
    return 'dashboard';
  }

  return null;
}

export function getSubNavigationSectionKeys(
  key: GlobalNavigationKey | null,
): readonly PhytoSectionKey[] {
  return key ? SUBNAV_SECTION_KEYS_BY_GLOBAL_KEY[key] : [];
}
