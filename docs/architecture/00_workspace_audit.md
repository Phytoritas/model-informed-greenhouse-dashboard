# Workspace Audit

## Mode
- Harness mode: `hybrid`
- Setup scope: `project`
- Active issue: `#61`
- Active branch: `hyp/61-rebuild-phytosync-into-coral-stay-routed-shell`
- Preserved merged baseline: issue `#57` frontend chunk split plus the earlier model-first runtime and routed-shell merges

## Target Repository Profile
- Repo type: Python-first greenhouse dashboard with Poetry packaging and a Vite frontend
- Current runtime maturity: backend/frontend runtime, model-first SmartGrow services, advisor routes, knowledge search, and RTR optimizer are already landed
- Active expansion mode: PhytoSync Coral Stay routed-shell redesign with route-level pages, compatibility containment, and shell/editorial cleanup
- Existing quality gates: `npm --prefix frontend run lint`, `npm --prefix frontend run test -- --pool=threads`, `npm --prefix frontend run build`, `poetry run pytest`, `poetry run ruff check .`

## Current Target Inventory
- `frontend/src/App.tsx`: root route registration, shell wiring, and explicit compatibility redirects
- `frontend/src/layout/AppShell.tsx`, `frontend/src/components/shell/*`: shared routed shell chrome
- `frontend/src/app/route-meta.ts`: canonical primary-route metadata
- `frontend/src/pages/*-route-page.tsx`: dedicated route-level page composition
- `frontend/src/routes/phytosyncSections.ts`: assistant-first section metadata plus bounded compatibility helpers for advisor-lane intent and `/ask` redirect/hash handling
- `/overview|/control|/resources|/alerts/legacy`: explicit canonical redirects now owned directly in `frontend/src/App.tsx`
- `frontend/src/App.routing.test.tsx`: route-entry and navigation regression lock
- `docs/architecture/` and `.rah/`: durable architecture and control-plane state

## Directive Inventory
- Primary requirement: move the frontend to a true route-based shell with Coral Stay-inspired warm coral/red direction
- Required route surfaces: `/overview`, `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, `/settings`
- Required compatibility surfaces: `/growth`, `/nutrient`, `/protection`, `/harvest`, and `/ask#... -> /assistant#...`
- Required preservation rules: no backend contract regression, no route/runtime regression, no return to one oversized page

## Gap Snapshot
- Landed and reusable: direct top-level route pages, advisor-lane route page, routed assistant page, route-entry regression tests, and warm shell primitives
- Still coupled: `frontend/src/routes/phytosyncSections.ts` now uses `assistant` as the canonical knowledge section, but `ask-*` panel ids and `/ask` redirect semantics still feed compatibility helpers and advisor-lane intent
- Drift repaired in this loop: root blueprint, architecture mirror, workspace audit/system brief, implementation gate, and Memento hydration state are now resynced to the issue `#61` truth instead of the stale issue `#19/#27` state

## Earliest Gate Status
- AGENTS intake: passed
- Issue/branch linkage: passed
- Harness scaffold: passed
- Memento context/recall hydration: passed
- Routed primary-page extraction: passed
- Control-plane sync for issue `#61`: passed
- Next bounded implementation gate: ready once the control-plane sync lands

## Recommended Target Shape
- Keep the direct routed pages as the primary product shell
- Keep `App.tsx` focused on route registration and shared cross-route state wiring
- Keep `/legacy` aliases as explicit redirects only and do not reintroduce layout-level compatibility frames
- Keep `/assistant` canonical and `/ask` as compatibility only
