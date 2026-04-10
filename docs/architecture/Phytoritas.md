# Architecture Blueprint Mirror

Source of truth: [`/Phytoritas.md`](../../Phytoritas.md)

## Active lane
- Issue: `#65`
- Branch: `hyp/65-simplify-phytosync-ui-into-a-compact-coral-tile-shell`
- Mode: `compact coral tile PhytoSync shell simplification`

## Preserved baseline
- Keep the merged model-first SmartGrow runtime, advisor contracts, `/api/rtr/*`, weather, market, crop switching, and area-unit projections stable.
- Keep the routed-shell extraction from issue `#61` as the compatibility baseline, not the final layout target.
- Keep `/ask#... -> /assistant#...` compatibility unless a future issue retires it explicitly.

## Current gate picture
- Harness setup: passed
- Issue/branch linkage for issue `#65`: passed
- Blueprint sync for issue `#65`: in progress
- Five-page shell contract: pending
- Compact tile layout contract: pending
- Validation lock: pending

## Target packages
- `frontend/src/App.tsx`
- `frontend/src/app/route-meta.ts`
- `frontend/src/routes/phytosyncSections.ts`
- `frontend/src/layout/AppShell.tsx`
- `frontend/src/components/shell/*`
- `frontend/src/pages/*`
- `frontend/src/components/dashboard/*`

## Target runtime contracts
- visible primary route map: `/overview`, `/control`, `/crop-work`, `/resources`, `/alerts`
- hidden compatibility routes: `/assistant`, `/settings`
- control compatibility redirect: `/rtr -> /control#control-strategy`
- assistant compatibility redirect: `/ask#... -> /assistant#...`

## Next restart point
- Re-read `.rah/state/status.json`, `.rah/state/gates.json`, `.rah/memory/wakeup.md`, and `.rah/plans/current_loop.md`.
- Continue the next bounded phase by shrinking the primary shell contract before the page relayout expands.
