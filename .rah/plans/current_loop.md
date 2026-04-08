# Current Loop

## Active State
- Issue `#23` remains on branch `feat/23-dashboard-layout-kpi-first-hierarchy`, and PR `#24` now carries a follow-up pesticide-advisor detail hardening slice on the latest branch head.
- The full local validation ladder is green for that slice: `npm --prefix frontend run lint`, `npm --prefix frontend run test`, `npm --prefix frontend run build`, `poetry run ruff check .`, `poetry run pytest`. Refreshed Backend/Frontend Validation on PR `#24` are also green on the latest head.

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
  - a pesticide-advisor grower-detail pass that prefers Hangul product aliases in Korean mode, adds clearer `제품명/권장 주기/추천 교호안/예비 교호 대안` surfaces, derives grower-facing rotation reasons on the frontend from locale-safe backend codes, localizes backend limitation text on the frontend, and preserves backward compatibility when older payloads omit `rotation_guidance` or `rotation_alternatives`

## Exact Restart Step
1. Review and merge PR `#24` if no further issue `#23` grower-facing dashboard follow-up is required.
2. Fast-forward local `main` after merge.
3. Sync post-merge harness truth on `main`.
