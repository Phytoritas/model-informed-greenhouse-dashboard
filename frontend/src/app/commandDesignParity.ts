export const COMMAND_DESIGN_PARITY_CONTRACT = {
  storyId: 'PRD-001',
  issueId: '#133',
  stackBase: {
    branch: 'fix/132',
    requestedTip: '02292d1',
    rederivedHead: '536a3e8',
  },
  canonicalSurface: {
    path: '/overview',
    tab: 'Command',
  },
  paritySurfaces: [
    { path: '/overview', tab: 'Dashboard', marker: 'overview-dashboard' },
    { path: '/overview', tab: 'Watch', marker: 'overview-watch' },
    { path: '/trend', panel: 'WeatherTrendPanel', marker: 'trend-weather' },
    { path: '/trend', panel: 'WeatherOutlookPanel', marker: 'trend-weather' },
    { path: '/trend', panel: 'ProducePricesPanel', marker: 'trend-market' },
    { path: '/trend', panel: 'DecisionSnapshotGrid', marker: 'trend-decision' },
  ],
  designLanguage: {
    requiredClasses: ['sg-data-number', 'sg-eyebrow'],
    sharedComponents: ['DashboardCard', 'MetricCard', 'SectionHeader', 'StatusChip'],
    statusChipTones: ['growth', 'stable', 'warning', 'critical', 'muted'],
    palette: ['ivory', 'sage', 'tomato'],
  },
} as const;
