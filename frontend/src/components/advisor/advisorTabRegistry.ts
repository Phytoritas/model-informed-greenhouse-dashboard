import {
    Activity,
    FlaskConical,
    Leaf,
    ShieldCheck,
    Sprout,
    Sun,
    type LucideIcon,
} from 'lucide-react';

export type PromptAdvisorTabKey =
    | 'environment'
    | 'physiology'
    | 'work'
    | 'pesticide'
    | 'nutrient'
    | 'harvest_market';

export interface AdvisorTabRegistryEntry {
    key: PromptAdvisorTabKey;
    label: string;
    icon: LucideIcon;
    endpoint: string;
    kind: 'actionable' | 'on-demand';
}

export const ADVISOR_TAB_ENDPOINTS = {
    environment: '/advisor/tab/environment',
    physiology: '/advisor/tab/physiology',
    work: '/advisor/tab/work',
    pesticide: '/advisor/tab/pesticide',
    nutrient: '/advisor/tab/nutrient',
    correction: '/advisor/tab/correction',
    harvest_market: '/advisor/tab/harvest-market',
} as const;

export const ADVISOR_TAB_REGISTRY: AdvisorTabRegistryEntry[] = [
    {
        key: 'environment',
        label: 'Environment',
        icon: Sun,
        endpoint: ADVISOR_TAB_ENDPOINTS.environment,
        kind: 'on-demand',
    },
    {
        key: 'physiology',
        label: 'Physiology',
        icon: Leaf,
        endpoint: ADVISOR_TAB_ENDPOINTS.physiology,
        kind: 'on-demand',
    },
    {
        key: 'work',
        label: 'Work',
        icon: Sprout,
        endpoint: ADVISOR_TAB_ENDPOINTS.work,
        kind: 'on-demand',
    },
    {
        key: 'pesticide',
        label: 'Pesticide',
        icon: ShieldCheck,
        endpoint: ADVISOR_TAB_ENDPOINTS.pesticide,
        kind: 'actionable',
    },
    {
        key: 'nutrient',
        label: 'Nutrient',
        icon: FlaskConical,
        endpoint: ADVISOR_TAB_ENDPOINTS.nutrient,
        kind: 'actionable',
    },
    {
        key: 'harvest_market',
        label: 'Harvest & Market',
        icon: Activity,
        endpoint: ADVISOR_TAB_ENDPOINTS.harvest_market,
        kind: 'on-demand',
    },
];
