import {
  Bell,
  CircleGauge,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Sprout,
  Thermometer,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type { AppLocale } from '../i18n/locale';

export type PrimaryRouteKey =
  | 'overview'
  | 'control'
  | 'crop-work'
  | 'resources'
  | 'alerts';

export type AppRouteKey =
  | PrimaryRouteKey
  | 'assistant'
  | 'settings'
  | 'rtr';

export interface PrimaryRouteMeta {
  key: AppRouteKey;
  navKey: PrimaryRouteKey;
  path: string;
  label: string;
  shortLabel: string;
  description: string;
  title: string;
  heroDescription: string;
  icon: LucideIcon;
  visibleInNav: boolean;
}

const PRIMARY_ROUTE_ORDER: PrimaryRouteKey[] = [
  'overview',
  'control',
  'crop-work',
  'resources',
  'alerts',
];

function buildRouteCatalog(locale: AppLocale): PrimaryRouteMeta[] {
  const isKo = locale === 'ko';

  return [
    {
      key: 'overview',
      navKey: 'overview',
      path: '/overview',
      label: isKo ? '오늘 운영' : 'Overview',
      shortLabel: isKo ? '오늘 운영' : 'Overview',
      description: isKo ? '지금 상황, 오늘 할 일, 주의 알림을 한 화면에서 봅니다.' : 'See today’s operating state, tasks, and warnings together.',
      title: isKo ? '오늘 운영' : 'Today Operations',
      heroDescription: isKo ? '오늘 먼저 볼 값과 바로 할 일을 타일형 화면으로 정리했습니다.' : 'Start with today’s signals and next actions in one compact canvas.',
      icon: LayoutDashboard,
      visibleInNav: true,
    },
    {
      key: 'control',
      navKey: 'control',
      path: '/control',
      label: isKo ? '환경 제어' : 'Control',
      shortLabel: isKo ? '환경 제어' : 'Control',
      description: isKo ? '지금 조치, 온도 전략, 장치 상태를 함께 봅니다.' : 'Review live moves, temperature strategy, and device status together.',
      title: isKo ? '환경 제어' : 'Environment Control',
      heroDescription: isKo ? '난방, 냉방, 환기, 스크린, 이산화탄소 판단을 한 화면에 모았습니다.' : 'Keep heating, cooling, vent, screen, and CO2 decisions in one lane.',
      icon: Thermometer,
      visibleInNav: true,
    },
    {
      key: 'crop-work',
      navKey: 'crop-work',
      path: '/crop-work',
      label: isKo ? '생육작업' : 'Crop Work',
      shortLabel: isKo ? '생육작업' : 'Crop Work',
      description: isKo ? '생육 흐름, 작업 우선순위, 수확 흐름을 함께 봅니다.' : 'Track crop flow, work priorities, and harvest flow together.',
      title: isKo ? '생육작업' : 'Crop Work',
      heroDescription: isKo ? '마디 진행, 착과 부담, 작업량, 수확 흐름을 정리했습니다.' : 'Read node pace, crop load, labor pressure, and harvest flow together.',
      icon: Sprout,
      visibleInNav: true,
    },
    {
      key: 'resources',
      navKey: 'resources',
      path: '/resources',
      label: isKo ? '양액에너지' : 'Resources',
      shortLabel: isKo ? '양액에너지' : 'Resources',
      description: isKo ? '양액, 배액, 에너지, 비용, 시세를 한 화면에서 봅니다.' : 'Review nutrient, drainage, energy, cost, and market signals together.',
      title: isKo ? '양액에너지' : 'Resources',
      heroDescription: isKo ? '양액과 에너지 흐름을 비용 판단과 함께 정리했습니다.' : 'Keep nutrient and energy decisions tied to cost and market context.',
      icon: WalletCards,
      visibleInNav: true,
    },
    {
      key: 'alerts',
      navKey: 'alerts',
      path: '/alerts',
      label: isKo ? '경보' : 'Alerts',
      shortLabel: isKo ? '경보' : 'Alerts',
      description: isKo ? '긴급, 주의, 처리 이력을 분리해 봅니다.' : 'Separate urgent alerts, warnings, and handling history.',
      title: isKo ? '경보' : 'Alerts',
      heroDescription: isKo ? '바로 확인할 경보와 처리 기록을 한 화면에서 정리했습니다.' : 'Keep the current alert queue and history in one place.',
      icon: Bell,
      visibleInNav: true,
    },
    {
      key: 'assistant',
      navKey: 'overview',
      path: '/assistant',
      label: isKo ? '질문 도우미' : 'Assistant',
      shortLabel: isKo ? '질문 도우미' : 'Assistant',
      description: isKo ? '질문과 자료 찾기를 한곳에서 처리합니다.' : 'Keep question flow and document lookup together.',
      title: isKo ? '질문 도우미' : 'Assistant',
      heroDescription: isKo ? '질문, 자료 찾기, 최근 흐름을 한곳에 모았습니다.' : 'Keep ask, search, and recent flow in one place.',
      icon: MessageCircle,
      visibleInNav: false,
    },
    {
      key: 'settings',
      navKey: 'overview',
      path: '/settings',
      label: isKo ? '설정' : 'Settings',
      shortLabel: isKo ? '설정' : 'Settings',
      description: isKo ? '화면 기준과 연결 상태를 확인합니다.' : 'Review display defaults and connectivity.',
      title: isKo ? '설정' : 'Settings',
      heroDescription: isKo ? '표시 기준과 연결 상태를 확인합니다.' : 'Review display defaults and connectivity.',
      icon: Settings,
      visibleInNav: false,
    },
    {
      key: 'rtr',
      navKey: 'control',
      path: '/rtr',
      label: isKo ? '온도 전략' : 'Temperature Strategy',
      shortLabel: isKo ? '온도 전략' : 'Strategy',
      description: isKo ? '환경 제어 안의 온도 전략 비교 화면입니다.' : 'Hidden shortcut into the control temperature strategy view.',
      title: isKo ? '온도 전략' : 'Temperature Strategy',
      heroDescription: isKo ? '환경 제어 안에서 온도 전략 비교를 이어서 봅니다.' : 'Continue the temperature strategy view inside control.',
      icon: CircleGauge,
      visibleInNav: false,
    },
  ];
}

export function buildPrimaryRoutes(locale: AppLocale): PrimaryRouteMeta[] {
  return buildRouteCatalog(locale).filter((route) => route.visibleInNav);
}

function getAppRouteKey(pathname: string): AppRouteKey {
  if (pathname === '/' || pathname.startsWith('/overview')) return 'overview';
  if (pathname.startsWith('/control')) return 'control';
  if (pathname.startsWith('/rtr')) return 'rtr';
  if (pathname.startsWith('/crop-work')) return 'crop-work';
  if (pathname.startsWith('/resources')) return 'resources';
  if (pathname.startsWith('/alerts')) return 'alerts';
  if (pathname.startsWith('/assistant') || pathname.startsWith('/ask')) return 'assistant';
  if (pathname.startsWith('/settings')) return 'settings';

  if (pathname.startsWith('/growth') || pathname.startsWith('/harvest')) return 'crop-work';
  if (pathname.startsWith('/nutrient')) return 'resources';
  if (pathname.startsWith('/protection')) return 'alerts';

  return 'overview';
}

export function getPrimaryRouteKey(pathname: string): PrimaryRouteKey {
  const routeKey = getAppRouteKey(pathname);

  switch (routeKey) {
    case 'control':
    case 'rtr':
      return 'control';
    case 'crop-work':
      return 'crop-work';
    case 'resources':
      return 'resources';
    case 'alerts':
      return 'alerts';
    case 'assistant':
    case 'settings':
    case 'overview':
    default:
      return 'overview';
  }
}

export function getPrimaryRouteMeta(pathname: string, locale: AppLocale): PrimaryRouteMeta {
  const routes = buildRouteCatalog(locale);
  const key = getAppRouteKey(pathname);
  return routes.find((route) => route.key === key) ?? routes[0];
}

export function sortPrimaryRoutes(routes: PrimaryRouteMeta[]): PrimaryRouteMeta[] {
  const order = new Map(PRIMARY_ROUTE_ORDER.map((key, index) => [key, index]));
  return [...routes].sort((a, b) => (order.get(a.navKey) ?? 99) - (order.get(b.navKey) ?? 99));
}
