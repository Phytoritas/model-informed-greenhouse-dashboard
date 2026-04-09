## Summary

Rebuild the current PhytoSync frontend from the remaining giant-page composition into a routed, Coral Stay-inspired product shell with warm coral/red design tokens, real page navigation, and overflow-safe layouts.

## Why

- The current frontend still carries one-page coupling through shared route frames and oversized page composition.
- The visual tone is not yet aligned with the desired warm coral editorial direction.
- Page width, card rhythm, and chart sizing still feel unstable or overcrowded.
- Tabs and section switching do not yet feel like a real product with discrete pages.

## Scope

- Replace the dominant green/cool surfaces with warm coral/red theme tokens.
- Move the app to a stronger routed shell with shared sidebar, top header, and route-level page content.
- Preserve existing backend APIs, RTR optimizer flows, advisor surfaces, and actual-area projection.
- Rebuild overview, control, RTR, crop-work, resources, alerts, assistant, and settings into clearly scoped pages.
- Standardize layout primitives, chart containers, and Korean copy hierarchy.
- Keep route-level code splitting and stable chart rendering.

## Constraints

- Do not break `/api/rtr/*`, advisor, knowledge, market, weather, or area-unit contracts.
- Do not regress lint, test, or production build.
- Do not revert to a fake tabbed single-page structure.
- Do not keep large green hero blocks or overly dense dashboard walls.

## Validation

- `npm --prefix frontend run lint`
- `npm --prefix frontend run test -- --pool=threads`
- `npm --prefix frontend run build`

## Done Criteria

- Route-based shell is the primary navigation model.
- Coral/red tone is the active primary design system.
- Major pages no longer stack multiple analytical stories into one giant page.
- Layout widths, chart containers, and right-rail behavior are overflow-safe across desktop/tablet/mobile.
- Verification evidence is captured in the PR.
