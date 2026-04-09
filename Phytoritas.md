# Model-Informed Greenhouse Dashboard Blueprint

## Repository
- Repo root: `C:\Users\yhmoo\OneDrive\Phytoritas\projects\model-informed-greenhouse-dashboard`
- GitHub repo: `https://github.com/Phytoritas/model-informed-greenhouse-dashboard`
- Project name: `model-informed-greenhouse-dashboard`
- Package name: `model_informed_greenhouse_dashboard`
- Active issue: `#61`
- Active branch: `hyp/61-rebuild-phytosync-into-coral-stay-routed-shell`
- Preserved merged baselines: issues `#19`, `#23`, `#25`, `#27`, `#47`, `#49`, `#57`

## Active Lane
Issue `#61` rebuilds the PhytoSync frontend into a Coral Stay-inspired routed shell.
The mainline target is no longer a giant dashboard page with embedded section composition. The shell must now behave like a real product with explicit routes, bounded page layouts, and a warm coral-first visual rhythm.

## Preserved Baseline
- Keep the current backend runtime, WebSocket telemetry flow, weather/RTR/market panels, crop switching, and AI consult/chat behavior stable.
- Keep the merged model-first SmartGrow runtime from issue `#19`, including `/api/models/*`, `/api/advisor/*`, and the internal-model RTR baseline from issue `#27`.
- Keep `configs/rtr_profiles.json`, `/api/rtr/*`, advisor contracts, area-unit projection, and routed advisor lanes backward compatible.
- Keep the extracted issue `#61` route pages as the primary navigation surface: `/overview`, `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, `/settings`.

## Directive Summary
Issue `#61` must:
- make route-based navigation the primary interaction model
- keep each page focused on one operating story instead of stacking all analytical surfaces into one screen
- move the shell toward a warm Coral Stay editorial system without breaking current runtime behavior
- preserve direct advisor-lane entry for `/growth`, `/nutrient`, `/protection`, and `/harvest`
- keep `/ask#...` as a compatibility redirect into `/assistant#...`
- retire the remaining legacy-only `MainDashboard` compatibility composition before the first PR

## Source Of Truth
1. `Phytoritas.md`
2. GitHub issue `#61`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/memory/wakeup.md`
6. `.rah/plans/current_loop.md`
7. `docs/architecture/Phytoritas.md`
8. `docs/architecture/00_workspace_audit.md`
9. `docs/architecture/01_system_brief.md`
10. `docs/architecture/implementation/implementation_gate_checklist.md`
11. `docs/architecture/system/current_architecture_map.md`
12. Repo code and tests

## Non-Negotiables
- Do not break `/api/rtr/*`, `/api/models/*`, `/api/advisor/*`, weather, market, or area-unit contracts.
- Do not revert to a fake tabbed single-page structure.
- Do not regress direct route entry, sidebar navigation, or advisor-lane intent preservation.
- Do not change `/overview/legacy`, `/control/legacy`, `/resources/legacy`, or `/alerts/legacy` behavior without explicit canonical redirects and test updates.
- Do not let the routed shell drift away from the issue `#61` coral-first visual direction.

## Current Architecture Target
### Shell and Navigation
- `frontend/src/main.tsx`: `BrowserRouter` entry
- `frontend/src/App.tsx`: root route registration, cross-route state wiring, and explicit compatibility redirects
- `frontend/src/layout/AppShell.tsx`: shared shell canvas
- `frontend/src/components/shell/TopBar.tsx`: page-level title and crop/locale controls
- `frontend/src/components/shell/WorkspaceNav.tsx`: primary route navigation
- `frontend/src/app/route-meta.ts`: canonical primary-route metadata

### Route-Level Pages
- `frontend/src/pages/overview-route-page.tsx`
- `frontend/src/pages/control-route-page.tsx`
- `frontend/src/pages/rtr-route-page.tsx`
- `frontend/src/pages/crop-work-route-page.tsx`
- `frontend/src/pages/resources-route-page.tsx`
- `frontend/src/pages/alerts-route-page.tsx`
- `frontend/src/pages/assistant-route-page.tsx`
- `frontend/src/pages/settings-route-page.tsx`
- `frontend/src/pages/advisor-lane-route-page.tsx`

### Residual Compatibility Follow-Ups
- `/overview/legacy`, `/control/legacy`, `/resources/legacy`, and `/alerts/legacy` now redirect explicitly to their canonical routes
- the old `SectionRouteFrame` / `MainDashboard` wrapper chain is retired from the frontend runtime
- `frontend/src/routes/phytosyncSections.ts` now treats `assistant` as the canonical knowledge section while preserving `/ask` redirect and `ask-*` panel compatibility

## Phased Delivery
### Phase 0. Baseline preservation
- bind issue `#61` and the issue-based branch
- preserve backend/API/runtime behavior while changing only shell IA and presentation

### Phase 1. Primary route extraction
- extract `/overview`, `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, and `/settings` into dedicated route-level page composition
- keep advisor lanes route-driven

### Phase 2. Control-plane sync and recon
- realign `Phytoritas.md`, `docs/architecture/`, and `.rah/` around issue `#61`
- record the current route-shell seams, interfaces, and hotspots from observed code

### Phase 3. Legacy compatibility retirement
- replace the remaining `/overview|/control|/resources|/alerts` legacy frame composition with explicit canonical redirects
- remove the dead `SectionRouteFrame` / `MainDashboard` wrapper chain after the redirects land

### Phase 4. First PR bundle
- capture screenshots and route-validation evidence
- open the first PR once the legacy-only seam is isolated and the frontend ladder stays green

## Decision Gates
### Gate A. Runtime preservation
- backend/runtime contracts remain unchanged while the routed shell evolves

### Gate B. Route-shell primacy
- the eight primary pages render directly through route-level containers

### Gate C. Legacy compatibility retirement
- `/overview|/control|/resources|/alerts/legacy` behave only as explicit canonical redirects and no live `MainDashboard` frame chain remains

### Gate D. Coral shell consistency
- shared shell spacing, page headers, and theme tokens reinforce the issue `#61` visual direction

### Gate E. Validation lock
- `npm --prefix frontend run lint`
- `npm --prefix frontend run test -- --pool=threads`
- `npm --prefix frontend run build`

## Immediate Next Action
- keep the issue `#61` control plane synced to the routed-shell truth
- decide whether the remaining `ask-*` panel/hash naming should stay as compatibility-only or be renamed after the first PR
- extend routing tests only as needed to protect `/assistant`, `/ask#...`, and `/overview|/control|/resources|/alerts/legacy` redirect behavior before the first PR
