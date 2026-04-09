# Current Architecture Map

## Entry Points
- `frontend/src/main.tsx` mounts `BrowserRouter` and hands control to `frontend/src/App.tsx`.
- `frontend/src/App.tsx` owns route registration, shared shell wiring, cross-route intent preservation, and the remaining explicit compatibility redirects.
- `frontend/src/app/route-meta.ts` is the canonical source for primary-route labels, descriptions, icons, and active-workspace mapping.

## Core Modules
- `frontend/src/layout/AppShell.tsx`, `frontend/src/components/shell/TopBar.tsx`, and `frontend/src/components/shell/WorkspaceNav.tsx` provide the shared routed shell chrome.
- `frontend/src/pages/*-route-page.tsx` files compose the primary pages for `/overview`, `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, and `/settings`.
- `frontend/src/pages/advisor-lane-route-page.tsx` wraps `AdvisorTabs` for `/growth`, `/nutrient`, `/protection`, and `/harvest`.
- The preserved backend/model stack continues to feed the shell through the existing weather, RTR, market, advisor, and assistant hooks.

## External Interfaces
- Primary route contract: `/overview`, `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, `/settings`
- Compatibility routes: `/growth`, `/nutrient`, `/protection`, `/harvest`, `/ask#... -> /assistant#...`, `/overview|/control|/resources|/alerts/legacy -> canonical routes`
- Validation contract: `npm --prefix frontend run lint`, `npm --prefix frontend run test -- --pool=threads`, `npm --prefix frontend run build`

## Coupling / Hotspots
- `frontend/src/App.tsx` is smaller after the `/legacy` retirement, but it still centralizes a large amount of shared state derivation and cross-route intent wiring.
- `frontend/src/routes/phytosyncSections.ts` now canonicalizes the assistant section, but `/ask` redirect handling and `ask-*` panel ids still remain as bounded compatibility semantics.
- The old `SectionRouteFrame` / `MainDashboard` wrapper chain is retired; `/legacy` compatibility now lives only as explicit redirects.
- The control plane had drifted away from issue `#61`, so `.rah` and blueprint documents must stay synchronized with the live routed-shell state.
