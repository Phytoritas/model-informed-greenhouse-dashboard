# Current Loop

## Active State
- Issue `#23` remains on branch `feat/23-dashboard-layout-kpi-first-hierarchy`, and PR `#24` now carries the contextual grower-facing knowledge-search slice on validated head `f50834e`.
- Local validation ladder and refreshed GitHub Actions are green: `npm --prefix frontend run lint`, `npm --prefix frontend run test`, `npm --prefix frontend run build`, `poetry run ruff check .`, `poetry run pytest`, plus remote Backend/Frontend Validation on PR `#24`.

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
  - a farmer-facing terminology pass that renames academic/system-heavy wording into grower-friendly Korean labels, hides raw evidence/provenance cards from user-facing advisor tabs, localizes runtime/advisor summaries further, and refreshes backend advisory wording to avoid developer-facing terminology in the UI
  - a KPI strip layout hardening pass that moves warning-state chips and timestamps into a wrapped metadata row so `실시간/경고/최근 수집` text no longer collides inside narrow cards or the strip header
  - a SmartGrow quick-action pass that replaces the old non-interactive surface catalog with actionable `도구 열기` cards wired into the actual advisor tabs, including direct opening of the nutrient correction tool and Korean nutrient boundary wording in both frontend and backend summaries
  - a contextual knowledge-search pass that seeds the drawer from current dashboard/advisor/assistant context, auto-runs crop-matched preset queries, summarizes routed scope in grower-friendly Korean, hides internal API recovery wording, and locks the drawer behavior with a dedicated Vitest surface test

## Exact Restart Step
1. Keep PR `#24` on validated head `f50834e` unless a new issue `#23` regression or UX gap is explicitly selected.
2. If follow-up changes are requested, keep them bounded to a new documented slice and rerun the same local ladder before pushing.
3. Otherwise proceed to review/merge PR `#24`, then sync post-merge harness truth on `main`.
