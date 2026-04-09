# Implementation Gate Checklist

Implementation for issue `#61` is allowed only when the following items are explicit:

- [x] Active issue and issue-based branch exist for the Coral Stay routed-shell redesign
- [x] Root blueprint, architecture mirror, and `.rah` runtime state are realigned around issue `#61`
- [x] The eight primary routed pages are already extracted and verified as the main navigation model
- [x] Backend/model/advisor/RTR/weather/market/area-unit preservation rules are explicit
- [x] `/growth`, `/nutrient`, `/protection`, `/harvest`, and `/ask#... -> /assistant#...` compatibility rules are explicit
- [x] The remaining `MainDashboard` compatibility seam is retired and `/legacy` URLs now redirect explicitly to canonical pages
- [x] Frontend validation ladder and route-focused regressions are explicit

## Pass Rule
The issue `#61` implementation gate now passes for bounded route-shell follow-up work.
That pass authorizes:

- continued shell/layout polish on the extracted route pages
- compatibility alias cleanup and shell polish now that the legacy route-frame builders are retired
- route metadata and compatibility alias cleanup when protected by tests

It does not yet authorize:

- breaking `/api/*` contracts while doing frontend shell work
- changing `/legacy` or `/ask` compatibility redirects without an explicit compatibility decision and regression update
- claiming the first PR bundle is ready before the control plane and architecture docs reflect the retired legacy seam

## Current Assessment
- The direct routed shell is already live for `/overview`, `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, and `/settings`.
- `/growth`, `/nutrient`, `/protection`, and `/harvest` now render through `advisor-lane-route-page.tsx` rather than the old embedded dashboard frame.
- `/ask#...` now redirects into `/assistant#...`, preserving hash-based ask/search intent.
- `/overview|/control|/resources|/alerts/legacy` now normalize to their canonical routes through explicit redirects in `frontend/src/App.tsx`, and the old `SectionRouteFrame` / `MainDashboard` chain has been removed from the frontend runtime.
- The remaining architecture debt is now concentrated in `frontend/src/App.tsx` shared state wiring and the still-legacy `ask-*` panel/hash naming that remains behind the canonical `/assistant` section metadata.
- The current local validation baseline for issue `#61` remains `npm --prefix frontend run lint`, `npm --prefix frontend run test -- --pool=threads`, and `npm --prefix frontend run build`.
