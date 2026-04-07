# Current Loop

## Active State
- Issue `#23` remains on branch `feat/23-dashboard-layout-kpi-first-hierarchy`, and PR `#24` head now includes the Korean-visible-UI hardening follow-up commit `7abf02a`.
- Local validation ladder is green again: `poetry run ruff check .`, `poetry run pytest`, `npm --prefix frontend run lint`, `npm --prefix frontend run test`, `npm --prefix frontend run build`.

## Latest Delivered Baseline
- Issue `#21` remains the most recent merged baseline on `main`.
- Issue `#23` adds:
  - `sensorStatus.ts` utility with `deriveSensorStatus` and `buildStatusSummary`
  - `KpiStrip.tsx` component replacing 6 SensorCards with compact 4-tile + collapsible 2-tile strip
  - `NUMERIC_IDEAL_RANGES` per crop in `displayCopy.ts`
  - App.tsx restructured: KPI strip top, 2/3+1/3 center grid (CropDetails/ModelAnalytics/Charts left, AI Advisor/Weather/RTR right sticky sidebar), lower fold
  - `compact` prop on WeatherOutlookPanel and RTROutlookPanel
  - Typography polish: text-3xl/font-bold/darker grays on metric values
  - `AppShell`, common loading skeletons, and overlay drawer fallbacks extracted out of `App.tsx`
  - backend/frontend structured advisory display payloads with Korean heading parsing and action-first AI rendering
  - availability-aware chart nulling, per-field last-received timestamps, offline-over-missing summary precedence, and mobile language toggle recovery
  - Korean-mode copy cleanup across advisor/chat/runtime and major analytics surfaces
  - Korean visible-UI hardening across advisor tabs, SmartGrow labels, work-event compare labels, and stage/medium display helpers
  - post-PR follow-up cleanup that removes the remaining Korean-mode `AI`/`RAG`/`drawer` wording on user-visible surfaces, replaces raw knowledge route exposure with descriptive labels, localizes additional work-state tokens, and updates the WorkTab harness accordingly
  - pushed PR head `7abf02a` (`fix: harden korean dashboard copy surfaces`) so remote validation is rerunning against the latest localized copy surface

## Exact Restart Step
1. Watch PR `#24` GitHub Actions until backend/frontend validation settles on head `7abf02a`.
2. If remote checks fail, fix only the reported regression and rerun the local ladder for the touched surface.
3. Once PR validation is green, sync harness truth again and proceed to review/merge.
