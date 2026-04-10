# Current Loop

## Active State
- Issue `#65` is active on branch `hyp/65-simplify-phytosync-ui-into-a-compact-coral-tile-shell`.
- The issue61 routed shell on `main` is the preserved baseline, not the end state.
- The active target is now mostly landed: five-page compact coral tile shell, hidden assistant/settings routes, `/rtr` absorbed into control, bounded `1320px` content canvas, and assistant drawer entry points are all in place.

## Baseline To Preserve
- `main` already includes the merged issue `#61` routed-shell extraction and the post-merge `.rah` sync from issue `#63`.
- The baseline still exposes eight primary routes in `route-meta.ts`, a separate `/rtr` peer page, inline `/assistant`, and page wrappers with mixed width caps and stacked vertical cards.
- Those baseline facts should be treated as the donor structure for issue `#65`, not as a target to preserve visually.

## What Landed
1. The visible shell is reduced to `/overview`, `/control`, `/crop-work`, `/resources`, and `/alerts`.
2. `/assistant` and `/settings` are hidden from the sidebar and entered through the header/FAB/profile flow.
3. `/rtr` now behaves as a compatibility redirect into `/control#control-strategy`.
4. `PageCanvas`-based wrappers now cap routed pages at `1320px`, and overview/crop-work use the compact tile grid directly.
5. Resources, alerts, and hidden assistant/settings surfaces received additional Korean-first copy and coral-neutral tone cleanup in the latest follow-up slice.

## Exact Next Step
1. Keep PR `#66` in `Validating` and use review feedback to judge whether issue `#65` can close on the current branch.
2. If a follow-up is needed, isolate the remaining legacy `RTROptimizerPanel`-heavy control strategy surface into a smaller tile-native control summary issue instead of reopening the whole shell refactor.
3. Keep `.rah` runtime snapshots untracked and only commit durable blueprint/control-plane artifacts.
