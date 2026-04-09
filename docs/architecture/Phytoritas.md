# Architecture Blueprint Mirror

Source of truth: [`/Phytoritas.md`](../../Phytoritas.md)

## Active lane
- Issue: `#61`
- Branch: `hyp/61-rebuild-phytosync-into-coral-stay-routed-shell`
- Mode: `issue61 coral-stay routed-shell redesign`

## Preserved baseline
- Keep the merged issue `#19` model-first SmartGrow runtime and issue `#27` RTR optimizer baseline untouched.
- Keep weather, market, advisor, assistant, crop switching, and area-unit behavior stable while the shell changes.
- Keep direct advisor-lane entry and `/ask#... -> /assistant#...` compatibility.

## Current gate picture
- Harness setup: passed
- Issue/branch linkage for issue `#61`: passed
- Memento context/recall hydration for the active case: passed
- Primary routed pages for the eight top-level routes: passed
- Control-plane sync for issue `#61`: passed
- Remaining implementation gate: keep the control plane synced after retiring the legacy frame chain, then choose the next bounded alias/polish slice

## Target packages
- `frontend/src/App.tsx`
- `frontend/src/layout/AppShell.tsx`
- `frontend/src/components/shell/*`
- `frontend/src/app/route-meta.ts`
- `frontend/src/pages/*`
- `frontend/src/routes/phytosyncSections.ts`

## Target runtime contracts
- primary route map: `/overview`, `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, `/settings`
- advisor-lane routes: `/growth`, `/nutrient`, `/protection`, `/harvest`
- compatibility redirect: `/ask#... -> /assistant#...`
- canonical compatibility redirects: `/overview/legacy -> /overview`, `/control/legacy -> /control`, `/resources/legacy -> /resources`, `/alerts/legacy -> /alerts`

## Next restart point
- Re-read `.rah/state/status.json`, `.rah/state/gates.json`, `.rah/memory/wakeup.md`, and `.rah/plans/current_loop.md`.
- Then continue the next bounded phase: decide whether the remaining `ask-*` panel/hash compatibility should be left for post-PR cleanup without touching the direct routed pages.
