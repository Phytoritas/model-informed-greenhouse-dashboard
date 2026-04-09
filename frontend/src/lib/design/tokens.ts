export const phytoSyncTokens = {
  brand: {
    name: 'PhytoSync',
    accent: 'var(--sg-accent-violet)',
  },
  cropAccent: {
    cucumber: {
      accent: 'var(--sg-accent-forest)',
      surface: 'var(--sg-accent-forest-soft)',
    },
    tomato: {
      accent: 'var(--sg-accent-amber)',
      surface: 'var(--sg-accent-amber-soft)',
    },
  },
  workspaceTone: {
    overview: 'sg-tint-green',
    control: 'sg-tint-violet',
    growth: 'sg-tint-green',
    nutrient: 'sg-tint-blue',
    protection: 'sg-tint-amber',
    harvest: 'sg-tint-amber',
    resources: 'sg-tint-green',
    alerts: 'sg-tint-amber',
    ask: 'sg-tint-violet',
  },
} as const;

export type PhytoWorkspaceToneKey = keyof typeof phytoSyncTokens.workspaceTone;
