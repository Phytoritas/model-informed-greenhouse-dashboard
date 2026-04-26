# Architecture Blueprint Mirror

Source of truth: [`/Phytoritas.md`](../../Phytoritas.md)

## Baseline
- Branch baseline: `fix/112-backend-frontend-integration-audit-and-repair`
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
- Backend/frontend integration audit for issue `#112`: in progress
- Confirmed bounded repairs: RTR area-settings crop casing, RTR response and calibration crop typing drift, KRW/kWh frontend default drift, and exact/nested disconnected AdvisorTabs lane routes
- Open calibration backlog: issue `#3` remains blocked on real grower-approved windows
- Validation lock: required before issue `#112` can be reported complete

## Next Restart Point
- Re-read `AGENTS.md`, `Phytoritas.md`, `.rah/state/status.json`, `.rah/state/gates.json`, `.rah/memory/wakeup.md`, and `.rah/plans/current_loop.md`.
- Treat issue `#112` and branch `fix/112-backend-frontend-integration-audit-and-repair` as the active bounded integration lane.
- Keep issue `#3` blocked until operator-approved production windows are supplied.
- Do not expand beyond confirmed backend/frontend connection gaps without a new gate update.
