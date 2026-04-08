# Current Loop

## Active State
- Issue `#27` is active on branch `feat/27-overhaul-rtr-around-internal-model-optimizer-and-area-aware-projections`.
- The internal-model-only RTR backend plus frontend optimizer slice is landed and locally revalidated with the full ladder.

## Latest Delivered Baseline
- Issue `#25` remains the most recent merged baseline on `main`.
- That merged baseline adds:
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

## Current Issue #27 Delta
- Backend landed:
  - `services/rtr/internal_model_bridge.py`
  - `services/rtr/node_target_engine.py`
  - `services/rtr/objective_terms.py`
  - `services/rtr/lagrangian_optimizer.py`
  - `services/rtr/scenario_runner.py`
  - `services/rtr/rtr_deriver.py`
  - `services/rtr/unit_projection.py`
  - additive `/api/rtr/state|optimize|scenario|sensitivity|area-settings`
  - compatible `/api/rtr/profiles` v2 payload with baseline + optimizer metadata
- Frontend landed:
  - `frontend/src/context/AreaUnitContext.tsx` now owns canonical m² plus actual-area overrides per crop
  - `frontend/src/components/AreaUnitPanel.tsx` renders actual-area inputs plus house-level yield and energy projections
  - `frontend/src/hooks/useRtrOptimizer.ts` consumes `/api/rtr/state|optimize|scenario|sensitivity|area-settings` with optimizer-enable, default-mode, and area-source guards
  - `frontend/src/components/RTROptimizerPanel.tsx` now renders optimizer summary, gain/loss trade-off, crop-specific insight, setpoints, sensitivity, scenarios, and baseline fallback
  - `frontend/src/hooks/useGreenhouse.ts` no longer drives RTR-facing projections through the hardcoded `AREA_M2 = 3305.8` path
- Local validation now passes:
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`

## Exact Restart Step
1. Commit the landed issue `#27` RTR optimizer + area-aware projection slice.
2. Push `feat/27-overhaul-rtr-around-internal-model-optimizer-and-area-aware-projections` and open the issue `#27` PR for remote validation.
3. Watch GitHub Actions Backend/Frontend validation and only then move the project item to `Validating`.
4. Use the next loop for post-PR calibration follow-up: optimizer weight tuning, grower-approved RTR good-production windows, and richer house-specific constraint tuning.
