# Current Loop

## Active State
- Issue `#69` is active on branch `fix/69-clean-remaining-control-copy-residue-after-compact-shell`.
- `main` already carries the merged issue `#67` compact control summary baseline on top of the issue `#65` compact coral tile shell.
- The active target is narrower again: remove the remaining `/control` route copy residue without reopening route ids, section hashes, or optimizer contracts.

## Baseline To Preserve
- `main` already includes the merged issue `#65` five-page shell, hidden assistant/settings routes, `/rtr` compatibility redirect, and bounded `1320px` page canvas.
- `main` also carries the merged issue `#67` compact `RTROptimizerPanel` summary/table surface on `/control`.
- Existing optimizer hooks, route wiring, section ids, and the current `ControlPanel` / `DecisionSnapshotGrid` composition should stay unchanged in this slice.

## Current Slice
1. The change surface is copy-only across `route-meta.ts`, `control-page.tsx`, `control-route-page.tsx`, `RTROutlookPanel.tsx`, `WeatherOutlookPanel.tsx`, plus the weather-label spillover in `App.tsx` and `DecisionSnapshotGrid.tsx`.
2. The intended result is a Korean-first, grower-facing `/control` experience with simpler skeleton labels, less machine wording, and no raw backend English summary leaking into the weather panel.
3. `phytosyncSections.ts` and `ControlPanel.tsx` stay out of this phase unless a regression forces a second bounded slice.

## Exact Next Step
1. Commit and push the issue69 copy-cleanup slice with the refreshed `/control` screenshot at `artifacts/screenshots/issue69-control-copy-cleanup-final.png`.
2. Open the issue69 PR and move the project item from `Running` to `Validating` once the local ladder results are attached.
3. Decide after PR review whether the remaining `ControlPanel` English fallback labels and section-copy polish in `phytosyncSections.ts` should become a separate follow-up issue.
