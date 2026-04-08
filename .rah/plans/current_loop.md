# Current Loop

## Active State
- There is no active non-trivial implementation loop right now.
- `main` now includes the merged issue `#27` RTR optimizer baseline.
- The next substantial change should start from a fresh issue and issue-based branch.

## Latest Delivered Baseline
- Issue `#27` is now the most recent merged baseline on `main`.
- That merged baseline adds:
  - internal-model-only RTR backend services under `backend/app/services/rtr/`
  - additive `GET /api/rtr/profiles|state` and `POST /api/rtr/optimize|scenario|sensitivity|area-settings`
  - compatible `configs/rtr_profiles.json` v2 baseline + optimizer metadata
  - `AreaUnitContext` plus `AreaUnitPanel` for canonical m² + actual-area projection
  - `useRtrOptimizer` and `RTROptimizerPanel` as the primary RTR decision surface
  - `RTROutlookPanel` preserved as a baseline/fallback comparison card
  - backend/frontend tests for optimizer contracts, scenario/sensitivity payloads, area projection, and UI rendering
  - updated blueprint, README, implementation checklist, architecture note, gap register, and `.rah` restart surfaces for the merged RTR baseline

## Latest Validation Evidence
- Local ladder before merge:
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
- Local result:
  - `134 passed, 28 warnings`
- Remote validation before merge:
  - PR `#28`
  - GitHub Actions `Backend Validation`: pass
  - GitHub Actions `Frontend Validation`: pass

## Exact Restart Step
1. Open a fresh issue if post-merge RTR work should continue.
2. The most natural next bounded loop is calibration, not architecture foundation:
   - grower-approved RTR good-production windows
   - optimizer weight and risk-bound tuning
   - greenhouse/user area-default persistence promotion
3. If the next loop is not RTR-related, use `main` as the new clean baseline and keep issue `#27` only as the landed architecture reference.
