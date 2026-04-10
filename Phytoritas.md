# Model-Informed Greenhouse Dashboard Blueprint

## Repository
- Repo root: `C:\Users\yhmoo\OneDrive\Phytoritas\projects\model-informed-greenhouse-dashboard`
- GitHub repo: `https://github.com/Phytoritas/model-informed-greenhouse-dashboard`
- Project name: `model-informed-greenhouse-dashboard`
- Package name: `model_informed_greenhouse_dashboard`
- Active issue: `#65`
- Active branch: `hyp/65-simplify-phytosync-ui-into-a-compact-coral-tile-shell`
- Preserved merged baselines: issues `#19`, `#23`, `#25`, `#27`, `#47`, `#49`, `#57`, `#61`, `#63`

## Active Lane
Issue `#65` simplifies the routed PhytoSync frontend into a compact grower-facing operating shell.
The target is no longer just a routed coral shell. It must now become a tighter five-page operating app with a bounded tile grid, coral-first visual hierarchy, Korean grower-facing copy, and fewer competing navigation paths.

## Preserved Baseline
- Keep the current backend runtime, WebSocket telemetry flow, weather, advisor, market, crop switching, and area-unit behavior stable.
- Keep the merged model-first SmartGrow runtime from issue `#19`, including `/api/models/*`, `/api/advisor/*`, and the internal-model RTR baseline from issue `#27`.
- Keep `/api/rtr/*`, `configs/rtr_profiles.json`, advisor contracts, area-unit projection, and `/ask#... -> /assistant#...` compatibility stable unless a new issue retires them explicitly.
- Keep the routed shell extraction from issue `#61` as the baseline starting point, not as the final UI target.

## Directive Summary
Issue `#65` must:
- reduce the visible primary navigation to `/overview`, `/control`, `/crop-work`, `/resources`, and `/alerts`
- move assistant access out of the sidebar into a FAB/header-triggered right drawer while preserving `/assistant` as a hidden compatibility route
- move settings access out of the sidebar into the profile menu while preserving `/settings` as a hidden route
- absorb `/rtr` into `/control` as the temperature-strategy segment and treat `/rtr` as a compatibility redirect
- replace stacked vertical shells with a compact 12-column tile layout using `grid-auto-rows: 88px`
- cap the main content canvas at `1320px`, use a `248px` sidebar, and an `80px` header
- push the design system toward a coral-first Korean grower-facing UI with restrained green usage and fewer nested card/tabs patterns

## Source Of Truth
1. `Phytoritas.md`
2. GitHub issue `#65`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/memory/wakeup.md`
6. `.rah/plans/current_loop.md`
7. `docs/architecture/Phytoritas.md`
8. Repo code and tests

## Non-Negotiables
- Do not break `/api/rtr/*`, `/api/models/*`, `/api/advisor/*`, weather, market, or area-unit contracts.
- Do not re-introduce a fake single-page multi-tab dashboard shell.
- Do not keep `rtr`, `assistant`, or `settings` as visible peer items in the primary sidebar.
- Do not let nested tabs, card-within-card, or multi-button card actions remain the default page pattern.
- Do not keep large green hero panels or machine-like English operational copy in the grower-facing UI.

## Current Architecture Target
### Shell and Navigation
- `frontend/src/App.tsx`: route wiring should shrink toward route registration and shared state plumbing only
- `frontend/src/app/route-meta.ts`: visible primary-route metadata should represent only the five grower-facing pages
- `frontend/src/routes/phytosyncSections.ts`: section/tab metadata should normalize `/rtr` into `/control` and keep assistant/settings hidden from primary navigation
- `frontend/src/layout/AppShell.tsx`: bounded shell canvas with `1320px` content cap and `248px` sidebar contract
- `frontend/src/components/shell/TopBar.tsx`: `80px` header with page title, search, filters, alerts, assistant trigger, and profile/settings entry
- `frontend/src/components/shell/WorkspaceNav.tsx`: sidebar/mobile nav rendering only, with five visible items

### Route-Level Pages
- `frontend/src/pages/overview-route-page.tsx`
- `frontend/src/pages/control-route-page.tsx`
- `frontend/src/pages/crop-work-route-page.tsx`
- `frontend/src/pages/resources-route-page.tsx`
- `frontend/src/pages/alerts-route-page.tsx`
- `frontend/src/pages/assistant-route-page.tsx` (hidden compatibility route)
- `frontend/src/pages/settings-route-page.tsx` (hidden compatibility route)

### Layout Target
- Desktop grid: `12` columns
- Tablet grid: `8` columns
- Mobile grid: `4` columns
- `grid-auto-rows: 88px`
- Card heights must be row multiples, not content-driven
- Page-level segments are allowed, but only one segment layer per page and a maximum of three segment choices

## Phased Delivery
### Phase 0. Blueprint and control-plane sync
- bind issue `#65` and the issue-based branch
- rewrite the blueprint and `.rah` state around the compact coral tile shell

### Phase 1. Shell and route contract reduction
- reduce visible primary nav to five items
- hide assistant/settings from the sidebar
- normalize `/rtr` into the control route contract

### Phase 2. Shared shell and interaction simplification
- restyle `AppShell`, `TopBar`, and `WorkspaceNav`
- move assistant entry to a FAB/right drawer pattern
- move settings to the profile menu

### Phase 3. Page tile relayout
- rebuild `/overview`, `/control`, `/crop-work`, `/resources`, and `/alerts` into tile-based page shells
- keep charts readable and limited in count
- keep copy Korean-first and grower-facing

### Phase 4. Validation and review
- extend route/navigation regression coverage
- verify layout and copy changes in screenshots and the frontend ladder

## Decision Gates
### Gate A. Runtime preservation
- backend/runtime contracts remain unchanged while the shell and page IA evolve

### Gate B. Five-page shell
- only the five grower-facing destinations remain visible in primary navigation

### Gate C. Control absorption
- `/rtr` is no longer a visible peer page and resolves into control-specific temperature strategy behavior

### Gate D. Compact tile layout
- the primary pages render through a consistent tile grid, bounded width, and row-height system

### Gate E. Korean grower UX
- user-facing copy, status labels, and error states follow the new Korean-first dictionary and avoid machine-facing wording

### Gate F. Validation lock
- `npm --prefix frontend run lint`
- `npm --prefix frontend run test -- --pool=threads`
- `npm --prefix frontend run build`

## Immediate Next Action
- sync `route-meta.ts`, `phytosyncSections.ts`, and the shared shell to the five-page contract
- then relayout `/overview` and `/control` first so the new tile system is visible before the remaining pages follow
