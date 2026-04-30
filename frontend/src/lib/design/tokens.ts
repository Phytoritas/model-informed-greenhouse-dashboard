export const phytoSyncTokens = {
  brand: {
    name: 'PhytoSync',
    accent: 'var(--sg-color-primary)',
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
    control: 'sg-tint-rose',
    growth: 'sg-tint-green',
    nutrient: 'sg-tint-green',
    protection: 'sg-tint-amber',
    harvest: 'sg-tint-amber',
    resources: 'sg-tint-green',
    alerts: 'sg-tint-amber',
    ask: 'sg-tint-rose',
  },
} as const;

export type PhytoWorkspaceToneKey = keyof typeof phytoSyncTokens.workspaceTone;
