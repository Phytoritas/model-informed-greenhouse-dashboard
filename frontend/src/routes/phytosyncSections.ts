import {
    BadgeAlert,
    CircleGauge,
    Droplets,
    FlaskConical,
    Leaf,
    MessageCircle,
    ShieldAlert,
    Sprout,
    Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppLocale } from '../i18n/locale';
import type { DashboardWorkspaceKey } from '../components/shell/WorkspaceNav';
import type { PromptAdvisorTabKey } from '../components/advisor/advisorTabRegistry';

export type PhytoSectionKey =
    | 'overview'
    | 'control'
    | 'growth'
    | 'nutrient'
    | 'protection'
    | 'harvest'
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
                label: '오늘 한눈에',
                shortLabel: '한눈에',
                description: '지금 상태와 오늘 운영 방향을 먼저 봅니다.',
                icon: Sprout,
                workspace: 'command',
                heroTitle: '오늘 운영 흐름',
                heroDescription: '상태, 오늘 할 일, 주의할 점을 먼저 정리합니다.',
                tabs: [
                    { id: 'overview-hero', label: '핵심 판단' },
                    { id: 'overview-live', label: '실시간 상태' },
                    { id: 'overview-board', label: '오늘 조치' },
                ],
            },
            {
                key: 'control',
                path: '/control',
                label: '환경 제어',
                shortLabel: '환경',
                description: '온도, 습도, 환기, 빛 맞춤 온도를 같이 봅니다.',
                icon: CircleGauge,
                workspace: 'rtr',
                heroTitle: '환경 제어와 조건별 비교',
                heroDescription: '냉난방, 환기, 스크린, 비용 영향을 함께 비교합니다.',
                tabs: [
                    { id: 'control-rtr', label: '추천값' },
                    { id: 'control-compare', label: '조건별 비교' },
                    { id: 'control-effects', label: '영향 보기' },
                ],
            },
            {
                key: 'growth',
                path: '/growth',
                label: '생육·작업',
                shortLabel: '생육',
                description: '세력, 마디, 과부하, 작업 흐름을 확인합니다.',
                icon: Leaf,
                workspace: 'advisor',
                advisorTab: 'physiology',
                heroTitle: '생육과 작업 흐름',
                heroDescription: '세력과 작업 부담을 한 화면에서 읽습니다.',
                tabs: [
                    { id: 'growth-crop', label: '생육 상태' },
                    { id: 'growth-work', label: '작업 비교' },
                    { id: 'growth-trend', label: '추세' },
                ],
            },
            {
                key: 'nutrient',
                path: '/nutrient',
                label: '양액·관수',
                shortLabel: '양액',
                description: '양액 조정과 관수 판단을 바로 엽니다.',
                icon: Droplets,
                workspace: 'advisor',
                advisorTab: 'nutrient',
                heroTitle: '양액과 관수 판단',
                heroDescription: '현재 레시피, 보정 필요, 다음 조정안을 바로 확인합니다.',
                tabs: [
                    { id: 'nutrient-advice', label: '현재 판단' },
                    { id: 'nutrient-tool', label: '보정 도구' },
                    { id: 'nutrient-watch', label: '주의 항목' },
                ],
            },
            {
                key: 'protection',
                path: '/protection',
                label: '병해충·방제',
                shortLabel: '방제',
                description: '방제 판단과 교호 전략을 확인합니다.',
                icon: ShieldAlert,
                workspace: 'advisor',
                advisorTab: 'pesticide',
                heroTitle: '병해충 확인과 방제 판단',
                heroDescription: '지금 확인할 병해충 후보와 방제안을 빠르게 봅니다.',
                tabs: [
                    { id: 'protection-risk', label: '위험 징후' },
                    { id: 'protection-plan', label: '방제안' },
                    { id: 'protection-check', label: '추가 확인' },
                ],
            },
            {
                key: 'harvest',
                path: '/harvest',
                label: '수확·출하',
                shortLabel: '수확',
                description: '수확 추세와 시장 흐름을 함께 봅니다.',
                icon: Truck,
                workspace: 'advisor',
                advisorTab: 'harvest_market',
                heroTitle: '수확과 출하 판단',
                heroDescription: '수확 흐름, 가격 변화, 출하 타이밍을 같이 봅니다.',
                tabs: [
                    { id: 'harvest-summary', label: '출하 흐름' },
                    { id: 'harvest-market', label: '시장 가격' },
                    { id: 'harvest-forecast', label: '앞으로 보기' },
                ],
            },
            {
                key: 'resources',
                path: '/resources',
                label: '자재·비용',
                shortLabel: '비용',
                description: '에너지, 자재, 비용 흐름을 확인합니다.',
                icon: FlaskConical,
                workspace: 'resources',
                heroTitle: '자재와 비용 흐름',
                heroDescription: '에너지, 물, 가격, 자재 부담을 운영 판단과 연결합니다.',
                tabs: [
                    { id: 'resources-energy', label: '에너지' },
                    { id: 'resources-market', label: '시장' },
                    { id: 'resources-stock', label: '자재' },
                ],
            },
            {
                key: 'alerts',
                path: '/alerts',
                label: '주의 알림',
                shortLabel: '알림',
                description: '즉시 봐야 할 주의와 막힘을 모아 봅니다.',
                icon: BadgeAlert,
                workspace: 'alerts',
                heroTitle: '지금 확인할 주의 알림',
                heroDescription: '읽기 위한 목록이 아니라 바로 조치할 항목만 남깁니다.',
                tabs: [
                    { id: 'alerts-priority', label: '우선 확인' },
                    { id: 'alerts-stream', label: '알림 흐름' },
                    { id: 'alerts-history', label: '기록' },
                ],
            },
            {
                key: 'assistant',
                path: '/assistant',
                label: 'AI 도우미',
                shortLabel: '도우미',
                description: '자료 찾기와 질문 흐름을 한곳에 모읍니다.',
                icon: MessageCircle,
                workspace: 'knowledge',
                heroTitle: '질문과 자료 찾기',
                heroDescription: '막히는 판단은 자료를 찾고 바로 질문으로 이어갑니다.',
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
                description: 'See the current state and today’s direction first.',
                icon: Sprout,
                workspace: 'command',
                heroTitle: 'Overview',
                heroDescription: 'Start with status, actions, and watch items.',
                tabs: [
                    { id: 'overview-hero', label: 'Priority' },
                    { id: 'overview-live', label: 'Live state' },
                    { id: 'overview-board', label: 'Today board' },
                ],
            },
            {
                key: 'control',
                path: '/control',
                label: 'Control',
                shortLabel: 'Control',
                description: 'Review climate control and the light-linked temperature lane.',
                icon: CircleGauge,
                workspace: 'rtr',
                heroTitle: 'Control lane',
                heroDescription: 'Compare HVAC, vent, screen, and cost effects in one lane.',
                tabs: [
                    { id: 'control-rtr', label: 'Recommendation' },
                    { id: 'control-compare', label: 'Compare' },
                    { id: 'control-effects', label: 'Effects' },
                ],
            },
            {
                key: 'growth',
                path: '/growth',
                label: 'Growth & Work',
                shortLabel: 'Growth',
                description: 'Track vigor, node pace, load, and work pressure.',
                icon: Leaf,
                workspace: 'advisor',
                advisorTab: 'physiology',
                heroTitle: 'Growth and work',
                heroDescription: 'Read crop momentum and labor pressure together.',
                tabs: [
                    { id: 'growth-crop', label: 'Crop state' },
                    { id: 'growth-work', label: 'Work compare' },
                    { id: 'growth-trend', label: 'Trend' },
                ],
            },
            {
                key: 'nutrient',
                path: '/nutrient',
                label: 'Nutrient & Irrigation',
                shortLabel: 'Nutrient',
                description: 'Open nutrient and irrigation decisions directly.',
                icon: Droplets,
                workspace: 'advisor',
                advisorTab: 'nutrient',
                heroTitle: 'Nutrient and irrigation lane',
                heroDescription: 'Keep recipe, correction, and next-step steering together.',
                tabs: [
                    { id: 'nutrient-advice', label: 'Current read' },
                    { id: 'nutrient-tool', label: 'Correction tool' },
                    { id: 'nutrient-watch', label: 'Watch items' },
                ],
            },
            {
                key: 'protection',
                path: '/protection',
                label: 'Protection',
                shortLabel: 'Protection',
                description: 'Review pest pressure and protection choices.',
                icon: ShieldAlert,
                workspace: 'advisor',
                advisorTab: 'pesticide',
                heroTitle: 'Protection decisions',
                heroDescription: 'Surface the current pest risk and next protection step fast.',
                tabs: [
                    { id: 'protection-risk', label: 'Risk' },
                    { id: 'protection-plan', label: 'Plan' },
                    { id: 'protection-check', label: 'Checks' },
                ],
            },
            {
                key: 'harvest',
                path: '/harvest',
                label: 'Harvest & Shipment',
                shortLabel: 'Harvest',
                description: 'Review harvest pace and market direction together.',
                icon: Truck,
                workspace: 'advisor',
                advisorTab: 'harvest_market',
                heroTitle: 'Harvest and shipment lane',
                heroDescription: 'Link harvest trend, market move, and shipment timing.',
                tabs: [
                    { id: 'harvest-summary', label: 'Flow' },
                    { id: 'harvest-market', label: 'Market' },
                    { id: 'harvest-forecast', label: 'Forecast' },
                ],
            },
            {
                key: 'resources',
                path: '/resources',
                label: 'Resources & Cost',
                shortLabel: 'Resources',
                description: 'Keep energy, material, and cost in view.',
                icon: FlaskConical,
                workspace: 'resources',
                heroTitle: 'Resources and cost',
                heroDescription: 'Keep energy, water, prices, and stock tied to decisions.',
                tabs: [
                    { id: 'resources-energy', label: 'Energy' },
                    { id: 'resources-market', label: 'Market' },
                    { id: 'resources-stock', label: 'Stock' },
                ],
            },
            {
                key: 'alerts',
                path: '/alerts',
                label: 'Alerts',
                shortLabel: 'Alerts',
                description: 'Collect the issues that need action now.',
                icon: BadgeAlert,
                workspace: 'alerts',
                heroTitle: 'Alerts to review now',
                heroDescription: 'Keep only the issues that require action or verification now.',
                tabs: [
                    { id: 'alerts-priority', label: 'Priority' },
                    { id: 'alerts-stream', label: 'Stream' },
                    { id: 'alerts-history', label: 'History' },
                ],
            },
            {
                key: 'assistant',
                path: '/assistant',
                label: 'Assistant',
                shortLabel: 'Assist',
                description: 'Keep question flow and document lookup together.',
                icon: MessageCircle,
                workspace: 'knowledge',
                heroTitle: 'Ask and search lane',
                heroDescription: 'Move from blocked questions into search and explanation.',
                tabs: [
                    { id: 'assistant-chat', label: 'Ask' },
                    { id: 'assistant-search', label: 'Search' },
                    { id: 'assistant-history', label: 'Recent flow' },
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
        : pathname.startsWith('/crop-work')
            ? '/growth'
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
        case 'advisor':
            return '/growth';
        case 'rtr':
            return '/control';
        case 'crop':
            return '/growth';
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
            return '/nutrient';
        case 'pesticide':
            return '/protection';
        case 'harvest_market':
            return '/harvest';
        case 'environment':
        case 'physiology':
        case 'work':
        default:
            return '/growth';
    }
}
