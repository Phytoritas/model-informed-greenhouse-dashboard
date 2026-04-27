import {
  Bell,
  CircleGauge,
  FlaskConical,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Sprout,
  Thermometer,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type { AppLocale } from '../i18n/locale';

export type PrimaryRouteKey =
  | 'overview'
  | 'control'
  | 'rtr'
  | 'scenarios'
  | 'trend'
  | 'crop-work'
  | 'resources'
  | 'alerts'
  | 'assistant'
  | 'settings';

export type AppRouteKey = PrimaryRouteKey;

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
  'rtr',
  'scenarios',
  'trend',
  'crop-work',
  'resources',
  'alerts',
  'assistant',
  'settings',
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
      description: isKo ? '지금 상황, 오늘 할 일, 확인 필요 항목을 한 화면에서 봅니다.' : 'See today’s operating state, tasks, and warnings together.',
      title: isKo ? '오늘 운영' : 'Today Operations',
      heroDescription: isKo ? '스마트 온실 인공지능 의사결정 플랫폼' : 'Start with today’s signals and next actions in one compact canvas.',
      icon: LayoutDashboard,
      visibleInNav: true,
    },
    {
      key: 'control',
      navKey: 'control',
      path: '/control',
      label: isKo ? '온실 환경' : 'Climate',
      shortLabel: isKo ? '온실 환경' : 'Climate',
      description: isKo ? '환경 솔루션, RTR 제어안, 장치 상태를 함께 봅니다.' : 'Review climate solutions, RTR control, and device status together.',
      title: isKo ? '온실 환경 솔루션' : 'Climate Solutions',
      heroDescription: '',
      icon: Thermometer,
      visibleInNav: true,
    },
    {
      key: 'trend',
      navKey: 'trend',
      path: '/trend',
      label: isKo ? '날씨와 시세' : 'Trend',
      shortLabel: isKo ? '날씨와 시세' : 'Trend',
      description: isKo ? '날씨와 도매 시세를 바로 확인합니다.' : 'Track weather and wholesale market trends in a separate lane.',
      title: isKo ? '날씨와 시세' : 'Trend',
      heroDescription: isKo ? '날씨 추세, 시세 흐름, 오늘의 판단 신호를 그래프로 확인합니다.' : 'Review weather charts, market movement, and current decision signals.',
      icon: TrendingUp,
      visibleInNav: true,
    },
    {
      key: 'scenarios',
      navKey: 'scenarios',
      path: '/scenarios',
      label: isKo ? '시나리오' : 'Scenarios',
      shortLabel: isKo ? '시나리오' : 'Scenarios',
      description: isKo ? '과정기반모델 What-if와 RTR 편미분을 별도 실험실에서 실행합니다.' : 'Run process-model what-if and RTR partial sensitivity experiments.',
      title: isKo ? '시나리오 실험실' : 'Scenario Lab',
      heroDescription: isKo ? '온도, CO2, 상대습도 변경이 수량과 에너지에 미치는 영향을 계산합니다.' : 'Test how temperature, CO2, and RH changes move yield and energy.',
      icon: FlaskConical,
      visibleInNav: true,
    },
    {
      key: 'crop-work',
      navKey: 'crop-work',
      path: '/crop-work',
      label: isKo ? '작물 상태 및 농작업' : 'Crop Work',
      shortLabel: isKo ? '작물·농작업' : 'Crop Work',
      description: isKo ? '생육 흐름, 작업 우선순위, 수확 흐름을 함께 봅니다.' : 'Track crop flow, work priorities, and harvest flow together.',
      title: isKo ? '작물 상태 및 농작업' : 'Crop Work',
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
      label: isKo ? '방제·알림' : 'Protection',
      shortLabel: isKo ? '방제·알림' : 'Protection',
      description: isKo ? '농약 솔루션, 확인 필요, 처리 이력을 분리해 봅니다.' : 'Separate pesticide solutions, warnings, and handling history.',
      title: isKo ? '방제·알림' : 'Protection',
      heroDescription: isKo ? '병해충·농약 검토와 긴급 알림을 한 화면에서 정리했습니다.' : 'Keep pesticide review, warning queue, and history in one place.',
      icon: Bell,
      visibleInNav: true,
    },
    {
      key: 'assistant',
      navKey: 'assistant',
      path: '/assistant',
      label: isKo ? '질문 도우미' : 'Assistant',
      shortLabel: isKo ? '질문 도우미' : 'Assistant',
      description: isKo ? '질문과 자료 찾기를 한곳에서 처리합니다.' : 'Keep question flow and document lookup together.',
      title: isKo ? '질문 도우미와 자료 찾기' : 'Assistant',
      heroDescription: isKo ? '채팅 상담과 목차형 자료 검색을 같은 화면에서 진행합니다.' : 'Use chat and table-of-contents source lookup together.',
      icon: MessageCircle,
      visibleInNav: true,
    },
    {
      key: 'settings',
      navKey: 'settings',
      path: '/settings',
      label: isKo ? '설정' : 'Settings',
      shortLabel: isKo ? '설정' : 'Settings',
      description: isKo ? '화면 기준과 연결 상태를 확인합니다.' : 'Review display defaults and connectivity.',
      title: isKo ? '연결 상태와 운영 설정' : 'Settings',
      heroDescription: isKo ? '연락/연동 상태와 작물별 가격·전력 단가를 확인합니다.' : 'Review service contact points, connectivity, and crop-specific assumptions.',
      icon: Settings,
      visibleInNav: true,
    },
    {
      key: 'rtr',
      navKey: 'rtr',
      path: '/rtr',
      label: isKo ? 'RTR 최적화' : 'RTR Optimizer',
      shortLabel: isKo ? 'RTR' : 'RTR',
      description: isKo ? '기준안과 최적안을 비교해 온도 전략을 조정합니다.' : 'Compare baseline and optimized temperature strategies.',
      title: isKo ? 'RTR 최적화' : 'RTR Optimizer',
      heroDescription: isKo ? '기준안, 최적안, 민감도, 면적 보정을 한곳에서 봅니다.' : 'Review baseline, optimized, sensitivity, and area-adjusted strategy views.',
      icon: CircleGauge,
      visibleInNav: true,
    },
  ];
}

export function buildPrimaryRoutes(locale: AppLocale): PrimaryRouteMeta[] {
  return sortPrimaryRoutes(buildRouteCatalog(locale).filter((route) => route.visibleInNav));
}

function getAppRouteKey(pathname: string): AppRouteKey {
  if (pathname === '/' || pathname.startsWith('/overview')) return 'overview';
  if (pathname.startsWith('/control')) return 'control';
  if (pathname.startsWith('/trend')) return 'trend';
  if (pathname.startsWith('/scenarios')) return 'scenarios';
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
      return 'control';
    case 'rtr':
      return 'rtr';
    case 'scenarios':
      return 'scenarios';
    case 'trend':
      return 'trend';
    case 'crop-work':
      return 'crop-work';
    case 'resources':
      return 'resources';
    case 'alerts':
      return 'alerts';
    case 'assistant':
      return 'assistant';
    case 'settings':
      return 'settings';
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
