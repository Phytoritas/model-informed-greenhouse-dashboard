# SmartGrow Command Center UI/UX Note

## Purpose
- Translate the editorial, no-line, tonal-layering language from `stitch/verdant_core/DESIGN.md` into a greenhouse-specific control cockpit.
- Preserve the current live optimizer, advisor, weather, market, and knowledge surfaces while making the first screen action-first instead of card-first.

## IA Translation
- `Command Center` becomes the default cockpit for today's control, risk, and action narrative.
- `Advisor`, `RTR & Control Studio`, `Crop & Work`, `Resources`, `Alerts`, and `Knowledge & Assistant` remain accessible as workspace-level surfaces instead of competing cards on one flat canvas.
- `m² canonical + actual area projection` remains intact; the redesign only changes presentation hierarchy, not calculation semantics.

## Design System Translation
- The shell uses a glass top bar, tonal surface layering, large editorial typography, and asymmetric content regions.
- Borders are de-emphasized in favor of spacing, surface tone, and soft shadows.
- Cards are treated as stacked operating sheets: hero, metric, alert, scenario, and narrative variants all inherit from a single `DashboardCard` primitive.
- Korean-first readability is favored through the existing locale layer plus the new headline/card primitives.

## Command Center Structure
- `HeroControlCard`: operating mode, primary issue, recommended actions, confidence, freshness.
- `LiveMetricStrip`: dense climate and physiology KPIs with freshness and missing-data state treatment.
- `TodayBoard`: now/today/week/watch sections that turn AI guidance into action blocks.
- `DecisionSnapshotGrid`: weather, market, energy, and crop context summarized for immediate decisions.
- `AlertRail`: compact intervention-oriented alert stream instead of a passive notification list.

## State and Performance Rules
- Live, delayed, stale, offline, and missing telemetry states are expressed through dedicated status chips instead of defaulting to numeric zero.
- The new shell keeps expensive surfaces behind stable workspace regions and preserves existing lazy-loaded panels.
- KPI tile arrays and workspace rails rely on memoized selectors and stable keys to reduce unnecessary rerender churn before chart-specific stabilization work continues.

## Follow-up
- Continue migrating the remaining advisor/resource/alerts surfaces into the same design system primitives.
- Capture before/after screenshots once the new shell is also exercised through local browser smoke.
