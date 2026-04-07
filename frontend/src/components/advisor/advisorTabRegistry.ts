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
    kind: 'actionable' | 'pending';
}

export const ADVISOR_TAB_REGISTRY: AdvisorTabRegistryEntry[] = [
    {
        key: 'environment',
        label: 'Environment',
        icon: Sun,
        endpoint: '/advisor/tab/environment',
        kind: 'pending',
    },
    {
        key: 'physiology',
        label: 'Physiology',
        icon: Leaf,
        endpoint: '/advisor/tab/physiology',
        kind: 'pending',
    },
    {
        key: 'work',
        label: 'Work',
        icon: Sprout,
        endpoint: '/advisor/tab/work',
        kind: 'pending',
    },
    {
        key: 'pesticide',
        label: 'Pesticide',
        icon: ShieldCheck,
        endpoint: '/advisor/tab/pesticide',
        kind: 'actionable',
    },
    {
        key: 'nutrient',
        label: 'Nutrient',
        icon: FlaskConical,
        endpoint: '/advisor/tab/nutrient',
        kind: 'actionable',
    },
    {
        key: 'harvest_market',
        label: 'Harvest & Market',
        icon: Activity,
        endpoint: '/advisor/tab/harvest-market',
        kind: 'pending',
    },
];
