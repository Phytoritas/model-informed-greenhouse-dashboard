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
  /** Concise Korean task label shown when the app locale is Korean. */
  labelKo: string;
  path: string;
  /** Contact stays routable from the landing footer but is not a workspace tab. */
  visibleInNav: boolean;
}

export const GLOBAL_NAVIGATION_ITEMS: readonly GlobalNavigationItem[] = [
  { key: 'home', label: 'HOME', labelKo: '홈', path: '/overview', visibleInNav: true },
  { key: 'dashboard', label: 'DASHBOARD', labelKo: '온실 환경', path: '/control', visibleInNav: true },
  { key: 'insights', label: 'INSIGHTS', labelKo: '날씨와 시세', path: '/trend', visibleInNav: true },
  { key: 'scenarios', label: 'SCENARIOS', labelKo: '시나리오', path: '/scenarios', visibleInNav: true },
  { key: 'knowledge', label: 'KNOWLEDGE', labelKo: '질문 도우미', path: '/assistant', visibleInNav: true },
  { key: 'contact', label: 'CONTACT', labelKo: '문의', path: '/contact', visibleInNav: false },
] as const;

export const VISIBLE_GLOBAL_NAVIGATION_ITEMS: readonly GlobalNavigationItem[] =
  GLOBAL_NAVIGATION_ITEMS.filter((item) => item.visibleInNav);

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
