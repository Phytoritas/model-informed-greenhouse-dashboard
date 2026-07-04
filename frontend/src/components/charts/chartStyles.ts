export const DASHBOARD_CHART_GRID_STROKE = 'rgba(123, 93, 78, 0.14)';
export const DASHBOARD_CHART_AXIS_STROKE = 'rgba(123, 93, 78, 0.24)';

export const DASHBOARD_CHART_TICK = {
  fill: 'var(--sg-text-faint)',
  fontSize: 10,
  fontWeight: 600,
} as const;

export const DASHBOARD_CHART_LEGEND_CLASSNAME =
  'flex flex-wrap items-center gap-2 text-[10px] font-semibold tracking-[0.06em] text-[color:var(--sg-text-faint)]';

export const DASHBOARD_CHART_LEGEND_STYLE = {
  color: 'var(--sg-text-muted)',
  fontSize: '10px',
  fontWeight: 650,
  paddingTop: '8px',
} as const;

export const DASHBOARD_CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 251, 246, 0.98)',
  border: '1px solid rgba(123, 93, 78, 0.12)',
  borderRadius: '12px',
  boxShadow: '0 12px 28px rgba(90, 64, 63, 0.10)',
  color: 'var(--sg-text-strong)',
  fontSize: '12px',
} as const;
