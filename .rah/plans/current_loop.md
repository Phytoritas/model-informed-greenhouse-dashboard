# Current Loop

## Active State
- Issue `#25` is merged via PR `#26`, and local `main` is fast-forwarded to merge commit `b90e959`.
- There is no active implementation loop right now; the issue `#25` grower-facing warning cleanup is the current merged baseline.

## Latest Delivered Baseline
- Issue `#25` is now the most recent merged baseline on `main`.
- That baseline adds:
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
  - a grower-facing warning cleanup pass that removes the last visible English/internal caveats from dashboard/advisor/chat surfaces, keeps only actionable pesticide label/registration guidance on screen, hides non-actionable implementation warnings from nutrient/correction/weather/meta UI, localizes degraded AI fallback copy, and records unresolved implementation scope only in `gap_register.md` plus `.rah`

## Exact Restart Step
1. Open a new issue for the next non-trivial change.
2. Branch from `main`.
3. Reuse the issue `#25` merged baseline unless a new bounded loop explicitly supersedes it.
