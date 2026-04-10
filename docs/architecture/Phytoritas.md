# Architecture Blueprint Mirror

Source of truth: [`/Phytoritas.md`](../../Phytoritas.md)

## Baseline
- Branch baseline: `main`
- Current merged UI baseline: issues `#65`, `#67`, `#69`, `#74`, `#80`, `#82`, `#84`
- Current control-plane sync baseline: issue `#86`

## Preserved Product Contract
- Keep the merged model-first SmartGrow runtime, advisor contracts, `/api/rtr/*`, weather, market, crop switching, and area-unit projections stable.
- Keep the routed PhytoSync shell with five visible grower pages as the current compatibility baseline.
- Keep `/rtr -> /control#control-strategy` and `/ask#... -> /assistant#...` compatibility unless a future issue retires them explicitly.

## Harness Maintenance Focus
- keep root/mirror blueprint pointers aligned with the merged `main` baseline
- keep tracked `.rah` control-plane files aligned with the same baseline
- rehydrate missing local-only `.rah` runtime seed files when harness doctor/status/resume require them
- keep the blocked RTR calibration backlog explicit so issue `#3` is not mistaken for hidden implementation drift

## Current Gate Picture
- Product shell baseline: passed
- Layout overlap and rail clipping follow-ups: passed
- Control realtime recovery baseline: passed
- Post-issue84 control-plane sync baseline: passed
- Open calibration backlog: issue `#3` remains blocked on real grower-approved windows
- Local runtime seed rehydration: required on this checkout when doctor reports missing files
- Validation lock: required for any new bounded slice

## Next Restart Point
- Re-read `AGENTS.md`, `Phytoritas.md`, `.rah/state/status.json`, `.rah/state/gates.json`, `.rah/memory/wakeup.md`, and `.rah/plans/current_loop.md`.
- Treat `main` as the post-issue84 baseline.
- Keep issue `#3` blocked until operator-approved production windows are supplied.
- Start any unrelated non-trivial product change from a fresh issue/branch.
