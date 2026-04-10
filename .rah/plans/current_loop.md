# Current Loop

## Active State
- Issue `#80` is active on branch `fix/80-realign-overlapping-layout-tiles-and-panels`.
- The branch stays bounded to layout overlap cleanup on top of the merged issue `#74` baseline: overview no longer forces large cards into `88px` auto rows, crop-work now follows the same natural 12-column rhythm, and overview charts expose a compact two-chart variant for the dashboard lane.
- Local validation is already green; the next gate is remote PR validation, not more broad refactoring.

## Latest Delivered Baseline
- `main` still includes the merged issue `#65` shell bundle:
  - visible navigation for `/overview`, `/control`, `/crop-work`, `/resources`, and `/alerts`
  - hidden compatibility routes for `/assistant`, `/settings`, and `/rtr`
  - a bounded `1320px` page canvas with the compact coral shell rhythm
- `main` also includes the merged issue `#67` compact `/control` strategy surface:
  - short strategy summary
  - recommended setpoint tiles
  - baseline-vs-recommended comparison table
  - preserved optimizer hook and route wiring
- `main` now includes the merged issue `#69` and issue `#74` copy cleanup chain:
  - grower-facing control-route metadata and shell copy
  - cleaner `RTROutlookPanel` / `WeatherOutlookPanel` wording plus shorter `ControlPanel` English fallbacks
  - refreshed `phytosyncSections.ts` English section descriptions and tab labels without changing route ids or hashes
  - Vitest coverage for the updated section-tab metadata

## Latest Validation
- The issue `#80` local ladder is green with:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --pool=threads`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
  - `git diff --check`
- The current frontend result is `20 files, 77 passed`, and the repo Python ladder remains `149 passed, 34 warnings`.
- Fresh browser captures for the active slice are:
  - `artifacts/screenshots/issue80-overview-before.png`
  - `artifacts/screenshots/issue80-overview-after.png`
  - `artifacts/screenshots/issue80-crop-work-before.png`
  - `artifacts/screenshots/issue80-crop-work-after.png`

## Exact Next Step
1. Commit the issue `#80` layout slice, push `fix/80-realign-overlapping-layout-tiles-and-panels`, and open the PR with the repo helper script.
2. Move the project item to `Validating` and watch GitHub Actions Backend/Frontend validation to green.
3. If reviewers report additional overlap outside the current overview/crop-work slice, open a follow-up issue instead of widening issue `#80` after review starts.
