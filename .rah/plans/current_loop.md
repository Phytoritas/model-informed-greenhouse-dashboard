# Current Loop

## Active State
- Issue `#67` is active on branch `hyp/67-simplify-legacy-control-strategy-surface-into-a-tile-native-summary`.
- `main` already carries the merged issue `#65` compact coral tile shell baseline.
- The active target is narrower: shrink the remaining legacy control strategy surface into a tile-native summary/table block without reopening the wider shell refactor.

## Baseline To Preserve
- `main` already includes the merged issue `#65` five-page shell, hidden assistant/settings routes, `/rtr` compatibility redirect, and bounded `1320px` page canvas.
- The control page is the only major surface still carrying an overlong RTR-heavy strategy block inside the new shell.
- Existing optimizer hooks, route wiring, and the current `ControlPanel` / `DecisionSnapshotGrid` composition should be preserved unless a regression forces wider churn.

## Current Slice
1. `RTROptimizerPanel` compact mode now owns the issue67 change surface.
2. The intended result is a short summary/table surface: today strategy summary, compact control tiles, baseline-vs-recommended comparison, and reason chips.
3. Scenario editor, sensitivity ladders, calibration workspace, and the deeper optimizer analysis should stay out of the compact `/control` path for now.

## Exact Next Step
1. Commit and push the compact `RTROptimizerPanel` summary/table slice plus its focused test and control-route skeleton copy update.
2. Open the issue67 PR and move the project item from `Running` to `Validating` once local checks and screenshots are attached.
3. Decide after PR review whether route-meta wording and weather/RTR fallback copy remain in issue67 or split into a smaller copy-only follow-up.
