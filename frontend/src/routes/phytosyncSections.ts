import {
  Bell,
  CircleGauge,
  Droplets,
  LayoutDashboard,
  MessageCircle,
  Sprout,
  type LucideIcon,
} from 'lucide-react';
import type { AppLocale } from '../i18n/locale';
import type { DashboardWorkspaceKey } from '../components/shell/WorkspaceNav';
import type { PromptAdvisorTabKey } from '../components/advisor/advisorTabRegistry';

export type PhytoSectionKey =
  | 'overview'
  | 'control'
  | 'crop-work'
  | 'resources'
  | 'alerts'
  | 'assistant';

export interface PhytoSectionTab {
  id: string;
  label: string;
}

export interface PhytoSectionDefinition {
  key: PhytoSectionKey;
  path: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  workspace: DashboardWorkspaceKey;
  advisorTab?: PromptAdvisorTabKey;
  heroTitle: string;
  heroDescription: string;
  tabs: PhytoSectionTab[];
}

export function buildPhytoSections(locale: AppLocale): PhytoSectionDefinition[] {
  return locale === 'ko'
    ? [
        {
          key: 'overview',
          path: '/overview',
          label: '오늘 운영',
          shortLabel: '오늘 운영',
          description: '지금 상태, 오늘 할 일, 주의 알림을 먼저 봅니다.',
          icon: LayoutDashboard,
          workspace: 'command',
          heroTitle: '오늘 운영',
          heroDescription: '핵심 판단, 오늘 할 일, 주의 신호를 한 화면에서 봅니다.',
          tabs: [
            { id: 'overview-core', label: '핵심' },
            { id: 'overview-tasks', label: '오늘 할 일' },
            { id: 'overview-watch', label: '주의' },
          ],
        },
        {
          key: 'control',
          path: '/control',
          label: '환경 제어',
          shortLabel: '환경 제어',
          description: '지금 조치, 온도 전략, 장치 상태를 함께 봅니다.',
          icon: CircleGauge,
          workspace: 'rtr',
          advisorTab: 'environment',
          heroTitle: '환경 제어',
          heroDescription: '추천 제어안과 온도 전략을 한 화면에서 비교합니다.',
          tabs: [
            { id: 'control-action', label: '지금 조치' },
            { id: 'control-strategy', label: '온도 전략' },
            { id: 'control-devices', label: '장치 상태' },
          ],
        },
        {
          key: 'crop-work',
          path: '/crop-work',
          label: '생육작업',
          shortLabel: '생육작업',
          description: '생육 흐름, 작업 우선순위, 수확 흐름을 함께 봅니다.',
          icon: Sprout,
          workspace: 'crop',
          advisorTab: 'physiology',
          heroTitle: '생육작업',
          heroDescription: '생육 상태와 작업 흐름을 한 화면에서 정리합니다.',
          tabs: [
            { id: 'crop-work-growth', label: '생육' },
            { id: 'crop-work-work', label: '작업' },
            { id: 'crop-work-harvest', label: '수확' },
          ],
        },
        {
          key: 'resources',
          path: '/resources',
          label: '양액에너지',
          shortLabel: '양액에너지',
          description: '양액, 배액, 에너지, 비용, 시세를 함께 봅니다.',
          icon: Droplets,
          workspace: 'resources',
          advisorTab: 'nutrient',
          heroTitle: '양액에너지',
          heroDescription: '양액과 에너지 흐름을 비용 판단에 연결합니다.',
          tabs: [
            { id: 'resources-nutrient', label: '양액' },
            { id: 'resources-energy', label: '에너지' },
            { id: 'resources-market', label: '시세' },
          ],
        },
        {
          key: 'alerts',
          path: '/alerts',
          label: '경보',
          shortLabel: '경보',
          description: '긴급, 주의, 처리 이력을 분리해 봅니다.',
          icon: Bell,
          workspace: 'alerts',
          advisorTab: 'pesticide',
          heroTitle: '경보',
          heroDescription: '바로 확인할 경보와 처리 흐름을 정리합니다.',
          tabs: [
            { id: 'alerts-urgent', label: '긴급' },
            { id: 'alerts-warning', label: '주의' },
            { id: 'alerts-history', label: '처리 이력' },
          ],
        },
        {
          key: 'assistant',
          path: '/assistant',
          label: '질문 도우미',
          shortLabel: '질문 도우미',
          description: '질문과 자료 찾기를 한곳에서 처리합니다.',
          icon: MessageCircle,
          workspace: 'knowledge',
          heroTitle: '질문 도우미',
          heroDescription: '질문, 자료 찾기, 최근 흐름을 한곳에 모았습니다.',
          tabs: [
            { id: 'assistant-chat', label: '질문' },
            { id: 'assistant-search', label: '자료 찾기' },
            { id: 'assistant-history', label: '최근 흐름' },
          ],
        },
      ]
    : [
        {
          key: 'overview',
          path: '/overview',
          label: 'Overview',
          shortLabel: 'Overview',
          description: "See today's state, work, and watch items first.",
          icon: LayoutDashboard,
          workspace: 'command',
          heroTitle: 'Today operations',
          heroDescription: 'Keep the key read, work queue, and warnings in one page.',
          tabs: [
            { id: 'overview-core', label: 'Summary' },
            { id: 'overview-tasks', label: 'Today' },
            { id: 'overview-watch', label: 'Watch' },
          ],
        },
        {
          key: 'control',
          path: '/control',
          label: 'Control',
          shortLabel: 'Control',
          description: 'See live actions, temperature strategy, and device state together.',
          icon: CircleGauge,
          workspace: 'rtr',
          advisorTab: 'environment',
          heroTitle: 'Environment control',
          heroDescription: 'Keep recommendation, temperature strategy, and device state in one lane.',
          tabs: [
            { id: 'control-action', label: 'Now' },
            { id: 'control-strategy', label: 'Temp plan' },
            { id: 'control-devices', label: 'Devices' },
          ],
        },
        {
          key: 'crop-work',
          path: '/crop-work',
          label: 'Crop Work',
          shortLabel: 'Crop Work',
          description: 'See crop flow, work priorities, and harvest flow together.',
          icon: Sprout,
          workspace: 'crop',
          advisorTab: 'physiology',
          heroTitle: 'Crop work',
          heroDescription: 'Keep growth pace, work load, and harvest flow in one page.',
          tabs: [
            { id: 'crop-work-growth', label: 'Growth' },
            { id: 'crop-work-work', label: 'Work' },
            { id: 'crop-work-harvest', label: 'Harvest' },
          ],
        },
        {
          key: 'resources',
          path: '/resources',
          label: 'Resources',
          shortLabel: 'Resources',
          description: 'See nutrient, drainage, energy, cost, and market signals together.',
          icon: Droplets,
          workspace: 'resources',
          advisorTab: 'nutrient',
          heroTitle: 'Resources',
          heroDescription: 'Keep nutrient and energy decisions tied to cost and market context.',
          tabs: [
            { id: 'resources-nutrient', label: 'Nutrients' },
            { id: 'resources-energy', label: 'Energy' },
            { id: 'resources-market', label: 'Market' },
          ],
        },
        {
          key: 'alerts',
          path: '/alerts',
          label: 'Alerts',
          shortLabel: 'Alerts',
          description: 'Separate urgent warnings, watch items, and history.',
          icon: Bell,
          workspace: 'alerts',
          advisorTab: 'pesticide',
          heroTitle: 'Alerts',
          heroDescription: 'Keep the current warning queue and history in one page.',
          tabs: [
            { id: 'alerts-urgent', label: 'Urgent' },
            { id: 'alerts-warning', label: 'Watch' },
            { id: 'alerts-history', label: 'History' },
          ],
        },
        {
          key: 'assistant',
          path: '/assistant',
          label: 'Assistant',
          shortLabel: 'Assistant',
          description: 'Keep ask and material search together.',
          icon: MessageCircle,
          workspace: 'knowledge',
          heroTitle: 'Assistant',
          heroDescription: 'Keep ask, material search, and recent flow in one place.',
          tabs: [
            { id: 'assistant-chat', label: 'Ask' },
            { id: 'assistant-search', label: 'Materials' },
            { id: 'assistant-history', label: 'Recent' },
          ],
        },
      ];
}

export function findPhytoSection(
  sections: PhytoSectionDefinition[],
  pathname: string,
): PhytoSectionDefinition {
  const normalizedPath = pathname.startsWith('/rtr')
    ? '/control'
    : pathname.startsWith('/growth') || pathname.startsWith('/harvest')
      ? '/crop-work'
      : pathname.startsWith('/nutrient')
        ? '/resources'
        : pathname.startsWith('/protection')
          ? '/alerts'
          : pathname.startsWith('/assistant') || pathname.startsWith('/ask')
            ? '/assistant'
            : pathname;

  return sections.find((section) => normalizedPath === section.path || normalizedPath.startsWith(`${section.path}/`))
    ?? sections[0];
}

export function getDefaultSectionPathForWorkspace(workspace: DashboardWorkspaceKey): string {
  switch (workspace) {
    case 'command':
      return '/overview';
    case 'rtr':
      return '/control';
    case 'crop':
    case 'advisor':
      return '/crop-work';
    case 'resources':
      return '/resources';
    case 'alerts':
      return '/alerts';
    case 'knowledge':
      return '/assistant';
    default:
      return '/overview';
  }
}

export function getSectionPathForAdvisorTab(tab: PromptAdvisorTabKey): string {
  switch (tab) {
    case 'nutrient':
      return '/resources#resources-nutrient';
    case 'pesticide':
      return '/alerts#alerts-warning';
    case 'harvest_market':
      return '/crop-work#crop-work-harvest';
    case 'environment':
      return '/control#control-strategy';
    case 'work':
      return '/crop-work#crop-work-work';
    case 'physiology':
    default:
      return '/crop-work#crop-work-growth';
  }
}
