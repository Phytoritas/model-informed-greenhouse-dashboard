# Current Loop

## Active State
- Product implementation issue `#114` is closed and PR `#115` is merged into `main`.
- Active docs-only sync issue: `#116`.
- Active branch: `docs/116-sync-issue114-merged-harness-state-on-main`.
- The blocked calibration backlog remains issue `#3`, waiting for grower-approved RTR windows.

## Stable Main Baseline
- PR `#113` merged issue `#112` into `main` at `079e373`.
- PR `#115` merged issue `#114` into `main` at `98b278a`.
- The current main baseline includes:
  - RTR area-settings crop casing repair and backend tolerance
  - RTR response/calibration crop key alignment
  - KRW/kWh frontend fallback alignment with backend settings
  - exact and nested `/growth`, `/nutrient`, `/protection`, and `/harvest` advisor lane access
  - nested `/ask/*` compatibility redirect to `/assistant` with hash intent preserved
  - boundary-wide backend crop normalization before state/service access
  - canonical harvest-market advisor tab metadata with underscore alias acceptance
  - visible produce-price fallback/degraded source status in frontend types and UI

## Latest Validation
- Issue `#114` local validation passed:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
  - `git diff --check`
  - `rah.py doctor|status|resume`
- GitHub Actions for PR `#115` passed both Backend Validation and Frontend Validation before merge.
- Issue `#114` Project Status and Stage were set to `Done`.

## Exact Next Step
1. Complete docs issue `#116` by committing this post-merge RAH sync.
2. Validate the docs-only sync with JSON parse, `git diff --check`, and RAH `doctor|status|resume`.
3. Open and merge the docs-only PR, then leave `main` with no active product implementation issue.
4. Keep issue `#3` blocked until real grower-approved windows exist.
