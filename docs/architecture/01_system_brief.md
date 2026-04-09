# System Brief

## Problem
The repository already has a functional backend, a validated model-first SmartGrow runtime, routed advisor lanes, and a partially modernized frontend shell.
The active problem is now frontend architecture: the app still carries too much giant-page and legacy compatibility composition inside `frontend/src/App.tsx`, even though the product intent is a true routed shell with discrete pages and a Coral Stay-inspired editorial system.

## Goal
Reshape the frontend so that:
- the shell behaves like a product with clear primary pages
- each page holds one operating story instead of inheriting the full dashboard stack
- the routed shell stays aligned with the preserved backend/model/advisor contracts
- the remaining compatibility aliases stay explicit, bounded, and removable without reviving the old dashboard frame

## Primary Actors
- greenhouse operator who needs direct page navigation and clear operating lanes
- routed shell that owns page-level IA, navigation, and presentation rhythm
- preserved backend/model runtime that continues to supply weather, RTR, market, advisor, and assistant data
- compatibility alias layer that keeps legacy URLs pointed at canonical pages while the modern shell finishes landing

## Source-To-Target Mapping
| Source surface | Target direction | Notes |
|---|---|---|
| `frontend/src/App.tsx` giant-page composition | route registration plus minimal shared state wiring | direct page composition is extracted; the remaining root-level debt is shared state concentration plus explicit compatibility redirects |
| `/overview|/control|/resources|/alerts/legacy` redirects in `frontend/src/App.tsx` | compatibility-only alias layer | keeps old deep links alive without reviving the old dashboard frame |
| `frontend/src/app/route-meta.ts` | canonical route metadata | owns the eight primary routes and sidebar highlight logic |
| `frontend/src/pages/*-route-page.tsx` | direct route containers | already hold the new route-level page stories |
| `frontend/src/routes/phytosyncSections.ts` | bounded compatibility/intent bridge | now canonicalizes the assistant section while keeping `/ask` redirect/hash compatibility bounded |

## Target Module Boundary
- `route_shell`: `App.tsx`, `AppShell.tsx`, `TopBar.tsx`, `WorkspaceNav.tsx`, `route-meta.ts`
- `route_pages`: `overview-route-page.tsx`, `control-route-page.tsx`, `rtr-route-page.tsx`, `crop-work-route-page.tsx`, `resources-route-page.tsx`, `alerts-route-page.tsx`, `assistant-route-page.tsx`, `settings-route-page.tsx`
- `advisor_lane_pages`: `advisor-lane-route-page.tsx` plus `/growth|/nutrient|/protection|/harvest`
- `legacy_compatibility`: `/legacy` redirects plus `/ask` alias handling

## Contract Targets
### Primary routes
- `/overview`
- `/control`
- `/rtr`
- `/crop-work`
- `/resources`
- `/alerts`
- `/assistant`
- `/settings`

### Compatibility routes
- `/growth`
- `/nutrient`
- `/protection`
- `/harvest`
- `/ask#... -> /assistant#...`
- `/overview/legacy -> /overview`
- `/control/legacy -> /control`
- `/resources/legacy -> /resources`
- `/alerts/legacy -> /alerts`

## Major Risks
1. `frontend/src/App.tsx` still mixes modern route registration with legacy-only surface builders, which makes the next refactor easy to overreach.
2. `frontend/src/routes/phytosyncSections.ts` now canonicalizes `/assistant`, but the remaining `ask-*` panel/hash compatibility can still drift if it is renamed carelessly.
3. The control plane had drifted to old issue `#19/#27` truths, so restart packets were no longer trustworthy until the current issue `#61` sync landed.
4. If the explicit `/legacy` redirects are removed or changed carelessly, old deep links can still collapse to the wrong canonical page or the wildcard fallback.

## Current Bounded Delivery Slice
- keep the direct routed pages untouched
- sync the control plane and architecture docs to issue `#61`
- retire the live `/legacy` frame chain with explicit redirects and dead-wrapper cleanup

## Deferred Until Later Phases
- deciding whether the remaining `ask-*` panel/hash compatibility should stay as-is until after the first PR
- deeper theme-token cleanup beyond the current coral-first route shell
- canonical removal of the old `ask` section model once `/assistant` is the only remaining knowledge-route truth
