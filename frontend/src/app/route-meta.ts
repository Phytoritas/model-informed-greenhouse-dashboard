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
  | 'rtr'
  | 'crop-work'
  | 'resources'
  | 'alerts'
  | 'assistant'
  | 'settings';

export interface PrimaryRouteMeta {
  key: PrimaryRouteKey;
  path: string;
  label: string;
  shortLabel: string;
  description: string;
  title: string;
  heroDescription: string;
  icon: LucideIcon;
}

const PRIMARY_ROUTE_ORDER: PrimaryRouteKey[] = [
  'overview',
  'control',
  'rtr',
  'crop-work',
  'resources',
  'alerts',
  'assistant',
  'settings',
];

export function buildPrimaryRoutes(locale: AppLocale): PrimaryRouteMeta[] {
  const isKo = locale === 'ko';

  return [
    {
      key: 'overview',
      path: '/overview',
      label: isKo ? '\uC624\uB298 \uC6B4\uC601' : 'Overview',
      shortLabel: isKo ? '\uC6B4\uC601' : 'Overview',
      description: isKo ? '\uC9C0\uAE08 \uBA3C\uC800 \uBCFC \uAC12\uACFC \uC624\uB298 \uC870\uCE58\uB97C \uD55C \uD750\uB984\uC73C\uB85C \uBD05\uB2C8\uB2E4.' : 'Start from today’s live signals and operating moves.',
      title: isKo ? '\uC624\uB298 \uC6B4\uC601' : 'Overview',
      heroDescription: isKo ? '\uC9C0\uAE08 \uBA3C\uC800 \uBCFC \uAC12\uACFC \uC624\uB298 \uC870\uCE58\uAC00 \uD55C\uB208\uC5D0 \uBCF4\uC785\uB2C8\uB2E4.' : 'See today’s live signals and next moves at a glance.',
      icon: LayoutDashboard,
    },
    {
      key: 'control',
      path: '/control',
      label: isKo ? '\uD658\uACBD \uC81C\uC5B4' : 'Control',
      shortLabel: isKo ? '\uC81C\uC5B4' : 'Control',
      description: isKo ? '\uD658\uAE30, \uB09C\uBC29, \uB0C9\uBC29, \uC2B5\uB3C4 \uC870\uCE58\uB97C \uD55C \uD750\uB984\uC73C\uB85C \uBD05\uB2C8\uB2E4.' : 'Review climate, vent, heating, cooling, and humidity in one lane.',
      title: isKo ? '\uD658\uACBD \uC81C\uC5B4' : 'Control',
      heroDescription: isKo ? '\uC9C0\uAE08 \uC81C\uC5B4 \uAD8C\uC7A5\uACFC 24\uC2DC\uAC04 \uD750\uB984\uC744 \uBD84\uB9AC\uD574\uC11C \uBD05\uB2C8\uB2E4.' : 'Keep the live control recommendation separate from the broader dashboard.',
      icon: Thermometer,
    },
    {
      key: 'rtr',
      path: '/rtr',
      label: isKo ? 'RTR \uCD5C\uC801\uD654' : 'RTR',
      shortLabel: 'RTR',
      description: isKo ? '\uC624\uB298 \uBAA9\uD45C \uC628\uB3C4\uC640 \uBE44\uAD50\uC548\uC744 \uB530\uB85C \uC815\uB9AC\uD569\uB2C8\uB2E4.' : 'Compare minimum-sufficient temperature options for today.',
      title: isKo ? 'RTR \uCD5C\uC801\uD654' : 'RTR Optimization',
      heroDescription: isKo ? '\uCD94\uCC9C\uC548, \uAE30\uC900\uC120, \uBE44\uAD50 \uC2DC\uB098\uB9AC\uC624\uB97C \uD55C \uD398\uC774\uC9C0\uC5D0\uC11C \uBD05\uB2C8\uB2E4.' : 'Keep the recommendation, baseline, and scenario table in one page.',
      icon: CircleGauge,
    },
    {
      key: 'crop-work',
      path: '/crop-work',
      label: isKo ? '\uC0DD\uC721/\uC791\uC5C5' : 'Crop & Work',
      shortLabel: isKo ? '\uC0DD\uC721' : 'Crop',
      description: isKo ? '\uC138\uB825, \uC791\uC5C5\uB7C9, \uC218\uD655 \uBD80\uB2F4\uC744 \uAC19\uC774 \uC77D\uC2B5\uB2C8\uB2E4.' : 'Read vigor, labor pressure, and harvest load together.',
      title: isKo ? '\uC0DD\uC721/\uC791\uC5C5' : 'Crop & Work',
      heroDescription: isKo ? '\uC0DD\uC721 \uC0C1\uD0DC\uC640 \uC624\uB298 \uC791\uC5C5 \uC6B0\uC120\uC21C\uC704\uB97C \uD568\uAED8 \uBD05\uB2C8\uB2E4.' : 'Track crop state and today’s work priorities together.',
      icon: Sprout,
    },
    {
      key: 'resources',
      path: '/resources',
      label: isKo ? '\uC790\uC6D0 \uAD00\uB9AC' : 'Resources',
      shortLabel: isKo ? '\uC790\uC6D0' : 'Resources',
      description: isKo ? '\uC591\uC561, \uC5D0\uB108\uC9C0, \uAC00\uACA9 \uD750\uB984\uC744 \uB530\uB85C \uBD05\uB2C8\uB2E4.' : 'Review nutrient, energy, and price signals in a dedicated lane.',
      title: isKo ? '\uC790\uC6D0 \uAD00\uB9AC' : 'Resources',
      heroDescription: isKo ? '\uC591\uC561, \uC5D0\uB108\uC9C0, \uAC00\uACA9 \uC2E0\uD638\uB97C overview\uC640 \uBD84\uB9AC\uD574\uC11C \uBD05\uB2C8\uB2E4.' : 'Keep resource and cost decisions out of the main overview.',
      icon: WalletCards,
    },
    {
      key: 'alerts',
      path: '/alerts',
      label: isKo ? '\uACBD\uBCF4' : 'Alerts',
      shortLabel: isKo ? '\uACBD\uBCF4' : 'Alerts',
      description: isKo ? '\uC989\uC2DC \uD655\uC778, \uC624\uB298 \uD655\uC778, \uCD94\uC801 \uC911\uC744 \uBD84\uB9AC\uD569\uB2C8\uB2E4.' : 'Separate urgent alerts from follow-up and history.',
      title: isKo ? '\uACBD\uBCF4' : 'Alerts',
      heroDescription: isKo ? 'overview\uC5D0\uB294 3\uAC1C\uB9CC \uB450\uACE0, \uB098\uBA38\uC9C0\uB294 \uC5EC\uAE30\uC11C \uC815\uB9AC\uD569\uB2C8\uB2E4.' : 'Keep overview light and move the full alert flow here.',
      icon: Bell,
    },
    {
      key: 'assistant',
      path: '/assistant',
      label: isKo ? 'AI \uB3C4\uC6B0\uBBF8' : 'Assistant',
      shortLabel: isKo ? '\uB3C4\uC6B0\uBBF8' : 'Ask',
      description: isKo ? '\uC9C8\uBB38, \uC790\uB8CC \uCC3E\uAE30, \uCD5C\uADFC \uCD94\uCC9C\uC744 \uD55C \uD398\uC774\uC9C0\uC5D0 \uBAA8\uC74D\uB2C8\uB2E4.' : 'Keep ask, search, and recent recommendations together.',
      title: isKo ? 'AI \uB3C4\uC6B0\uBBF8' : 'Assistant',
      heroDescription: isKo ? '\uBA54\uC778 \uD654\uBA74 \uD070 \uBC15\uC2A4 \uB300\uC2E0 \uB3C5\uB9BD \uD398\uC774\uC9C0\uB85C \uBD84\uB9AC\uD569\uB2C8\uB2E4.' : 'Use a dedicated page instead of a competing right-rail block.',
      icon: MessageCircle,
    },
    {
      key: 'settings',
      path: '/settings',
      label: isKo ? '\uC124\uC815' : 'Settings',
      shortLabel: isKo ? '\uC124\uC815' : 'Settings',
      description: isKo ? '\uD45C\uC2DC \uAE30\uC900\uACFC \uC5F0\uACB0 \uC0C1\uD0DC\uB97C \uD655\uC778\uD569\uB2C8\uB2E4.' : 'Review display, lane, and connection defaults.',
      title: isKo ? '\uC124\uC815' : 'Settings',
      heroDescription: isKo ? '\uC6B4\uC601 \uD654\uBA74\uACFC \uBD84\uB9AC\uB41C \uAE30\uBCF8 \uC124\uC815\uB9CC \uBAA8\uC544 \uBD05\uB2C8\uB2E4.' : 'Keep shell defaults and display settings in a separate screen.',
      icon: Settings,
    },
  ];
}

export function getPrimaryRouteKey(pathname: string): PrimaryRouteKey {
  if (pathname === '/' || pathname.startsWith('/overview')) return 'overview';
  if (pathname.startsWith('/control')) return 'control';
  if (pathname.startsWith('/rtr')) return 'rtr';
  if (pathname.startsWith('/crop-work')) return 'crop-work';
  if (pathname.startsWith('/resources')) return 'resources';
  if (pathname.startsWith('/alerts')) return 'alerts';
  if (pathname.startsWith('/assistant')) return 'assistant';
  if (pathname.startsWith('/settings')) return 'settings';

  if (pathname.startsWith('/growth')) return 'crop-work';
  if (pathname.startsWith('/nutrient')) return 'resources';
  if (pathname.startsWith('/protection')) return 'alerts';
  if (pathname.startsWith('/harvest')) return 'resources';
  if (pathname.startsWith('/ask')) return 'assistant';

  return 'overview';
}

export function getPrimaryRouteMeta(pathname: string, locale: AppLocale): PrimaryRouteMeta {
  const routes = buildPrimaryRoutes(locale);
  const key = getPrimaryRouteKey(pathname);
  return routes.find((route) => route.key === key) ?? routes[0];
}

export function sortPrimaryRoutes(routes: PrimaryRouteMeta[]): PrimaryRouteMeta[] {
  const order = new Map(PRIMARY_ROUTE_ORDER.map((key, index) => [key, index]));
  return [...routes].sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
}
