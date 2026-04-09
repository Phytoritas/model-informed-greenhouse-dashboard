# Current Loop

## Active State
- Issue `#61` is active on branch `hyp/61-rebuild-phytosync-into-coral-stay-routed-shell`.
- Root repo has moved off the idle post-issue57 baseline and into the Coral Stay routed-shell redesign loop.
- The current frontend already has BrowserRouter, route-level pages, and shadcn-style primitives, but `App.tsx` still centralizes a large amount of shared state wiring and alias handling.
- The control plane has been resynced to the issue `#61` truth so restart packets and Memento recipes no longer point at older RTR-era loops.
- Issue `#3` still remains intentionally `Blocked`, but only as the optional real grower-window calibration follow-up.

## Latest Delivered Baseline
- `main` already includes the merged issue `#57` frontend performance follow-up:
  - dedicated `react-vendor`, `router-vendor`, and `icon-vendor` chunk groups in `frontend/vite.config.ts`
  - preserved `markdown-vendor` boundary
  - production `index` chunk reduced from `513.46 kB` to `284.08 kB`
  - Vite `>500 kB` warning removed without changing runtime/API/UI behavior
- The current routed-shell donor baseline still includes:
  - BrowserRouter at `frontend/src/main.tsx`
  - route metadata plus compatibility helpers under `frontend/src/app/` and `frontend/src/routes/`
  - shadcn-style primitives under `frontend/src/components/ui/`
  - warm but still mixed editorial tokens under `frontend/src/styles/theme.css`
- The current session additionally realigns `Phytoritas.md`, `docs/architecture/`, `.rah/state/status.json`, `.rah/state/memento_status.json`, and `.rah/memory/*` to the live issue `#61` routed-shell loop so `doctor/status/resume` can restart from the correct branch, case, and next gate.
- The newest bounded frontend slice additionally replaces `/overview|/control|/resources|/alerts/legacy` with explicit canonical redirects in `frontend/src/App.tsx`, removes `frontend/src/routes/LegacyCompatibilityFrame.tsx`, and retires the dead `SectionRouteFrame` / `MainDashboard` wrapper chain from `frontend/src/`.
- The remaining gap is structural and visual rather than missing raw capability: the primary IA now routes through `/overview|/control|/rtr|/crop-work|/resources|/alerts|/assistant|/settings`, legacy deep links normalize through explicit redirects, assistant-first section metadata is canonical, and the next seam is the still-legacy `ask-*` panel/hash naming plus coral/red shell consolidation.

## Latest Validation
- Issue `#61` current route-retirement slice is locally green with:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --pool=threads`
  - `npm --prefix frontend run build`
- Frontend runtime smoke on `http://127.0.0.1:4180` confirms:
  - the previous `charts-vendor`/`react-vendor` `forwardRef` runtime failure is gone after removing the dedicated `recharts` manual chunk
  - `/overview`, `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, and `/settings` now render through dedicated route-level page composition containers instead of page JSX constants embedded in `frontend/src/App.tsx`
  - direct URL entry works for `/overview`, `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, and `/settings`
  - browser back navigation works across the new routed shell
  - with backend live on `127.0.0.1:8003`, `/resources`, `/alerts`, `/assistant`, and `/settings` also load with zero browser console errors after restarting the stale listener on port `8003`
  - the `assistant` route no longer squeezes the `바로 실행 도구` rail into a clipped desktop two-column launcher: `frontend/src/pages/assistant-page.tsx` now delays the right-rail split until `2xl`, and `frontend/src/components/SmartGrowSurfacePanel.tsx` supports a compact rail mode that stacks launcher content safely for the assistant summary lane
  - `/ask#...` no longer renders through the legacy `MainDashboard` frame and now redirects to `/assistant#...`, preserving the ask/search tab hash while keeping the routed shell consistent
  - `/growth`, `/nutrient`, `/protection`, and `/harvest` now render through a dedicated `frontend/src/pages/advisor-lane-route-page.tsx` container instead of the old `SectionRouteFrame`/`MainDashboard` compatibility layout
  - Playwright smoke on `/growth#growth-work` and `/nutrient#nutrient-tool` completed with zero browser console errors
- New regression coverage now includes `frontend/src/App.routing.test.tsx`, which locks direct route entry and sidebar-driven page transitions.
- Harness verification after the control-plane sync now confirms that `doctor/status/resume` agree on the issue `#61` case identity; the only remaining warnings are the still-uninstalled RAH hooks and missing optional `deployment.json`.
- The current validation pass also keeps the broader repo ladder green with `poetry run ruff check .` and full `poetry run pytest` (`149 passed, 34 warnings`) in addition to the issue `#61` frontend ladder.
- The latest route-shell hardening slice additionally confirms:
  - the overview hero advisor CTA now opens `/growth` through `handleOpenAdvisorTabs('environment')` instead of dropping into `/crop-work` without tab intent
  - the assistant summary rail can still open the nutrient correction lane while preserving both `initialTab="nutrient"` and `initialCorrectionToolOpen=true`
  - routed advisor-lane regressions now assert `initialTab` for `/growth`, `/nutrient`, `/protection`, and `/harvest` instead of only checking that `AdvisorTabs` mounted
- The newest cleanup slice additionally removes the dead `/growth` compatibility branches from `lowerFoldSurface` and `bottomRowSurface` in `frontend/src/App.tsx`; those branches were no longer reachable after `/crop-work` and `/growth` moved onto dedicated route pages.
- The newest cleanup slice additionally removes the dead advisor-only `leftColumnSurface` compatibility composition from `frontend/src/App.tsx`, along with the now-unused `advisorTabsAnchorRef` scroll wiring; routed pages keep opening advisor lanes through route/page containers instead of the old embedded column block.
- The newest cleanup slice additionally renames and gates `routeFrameProps` behind `legacyRouteFrameProps`, so the old `SectionRouteFrame` payload is only assembled for `/overview|/control|/resources|/alerts` legacy paths; `frontend/src/App.routing.test.tsx` now locks `/overview/legacy` direct entry against the mocked `MainDashboard` compatibility frame.
- The newest compatibility-retirement slice additionally replaces `/overview|/control|/resources|/alerts/legacy` with explicit canonical redirects, removes the temporary `LegacyCompatibilityFrame.tsx`, deletes the dead `SectionRouteFrame` / `MainDashboard` wrapper files, and updates `frontend/src/App.routing.test.tsx` so all four legacy URLs are locked to the correct canonical headings instead of a mocked compatibility frame.
- The newest assistant-alias slice additionally changes `frontend/src/routes/phytosyncSections.ts` so `assistant` is now the canonical knowledge-section key/path, `/ask` normalizes into `/assistant` during section lookup, and the focused route tests now lock that behavior without renaming the existing `ask-*` panel ids yet.
- The newest compatibility decision keeps `ask-chat|ask-search|ask-history` as inbound hash aliases until after the first issue `#61` PR so old bookmarks and `/ask#...` deep links keep resolving into the canonical `assistant-*` tabs.
- The current local validation baseline is green with:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --pool=threads`
  - `npm --prefix frontend run build`
  - latest frontend result: `18 files, 68 passed`
- The assistant-alias closeout also reran `poetry run ruff check .`, full `poetry run pytest` (`149 passed, 34 warnings`), and `rah.py doctor|status|resume`; harness doctor remains warn-only for the still-uninstalled hooks and missing optional `deployment.json`.
- Fresh screenshot artifacts for this slice are saved at `artifacts/screenshots/issue61-resources-route-extracted.png`, `artifacts/screenshots/issue61-assistant-route-extracted.png`, `artifacts/screenshots/assistant-clipping-fixed.png`, `artifacts/screenshots/issue61-crop-work-route-extracted.png`, `artifacts/screenshots/issue61-ask-redirected-to-assistant.png`, `artifacts/screenshots/issue61-growth-lane-route-page.png`, and `artifacts/screenshots/issue61-nutrient-lane-route-page.png`.

## Exact Next Step
1. Keep `ask-*` panel/hash normalization as bounded inbound compatibility until after the first issue `#61` PR; do not remove `normalizeAssistantPanelId()` or `/ask#...` hash preservation in the current bundle.
2. Keep preview `4180` + backend `8003` as the live review loop and reuse the same `max-w-[1280px]` page-container rhythm when any remaining legacy analytical surface still stretches or clips.
3. Prepare the issue `#61` first commit/PR bundle around the routed shell, advisor-lane extraction, legacy-frame retirement, and assistant canonicalization slices.
