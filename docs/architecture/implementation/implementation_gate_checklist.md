# Implementation Gate Checklist

Implementation for issue `#114` is allowed only for confirmed post-issue112 backend/frontend connection drifts.

- [x] Active issue `#114` and issue-based branch `fix/114-post-issue112-backend-frontend-integration-audit` exist.
- [x] Repo-local `AGENTS.md` and recursive architecture skill intake are complete.
- [x] Memento `context()` and narrow `recall()` were run before implementation.
- [x] Backend route inventory and frontend route/hook inventories were reviewed with subagent exploration.
- [x] Completed baseline: issue `#112` already repaired RTR crop casing, RTR response/calibration crop typing, KRW/kWh fallback, and AdvisorTabs lane route access.
- [x] Confirmed gap 1: route helpers advertise nested `/ask/*` aliases, but `App.tsx` only routed exact `/ask`.
- [x] Confirmed gap 2: crop normalization was inconsistent across backend API boundaries and some handlers ignored the normalized crop value.
- [x] Confirmed gap 3: advisor tab metadata mixed canonical `/api/advisor/tab/harvest-market` with underscore `/api/advisor/tab/harvest_market`.
- [x] Confirmed gap 4: SmartGrow frontend kept a duplicate planned-tab endpoint map instead of using the advisor tab registry route vocabulary.
- [x] Confirmed gap 5: backend market-price fallback returns `source.auth_mode="fallback"` plus degraded status fields, but frontend types/UI presented it as a normal KAMIS snapshot.
- [x] Existing `/api/models/*`, `/api/advisor/*`, `/api/rtr/*`, weather, market, crop switching, WebSocket, `/rtr`, `/legacy`, and issue `#112` regressions are preservation constraints.

## Pass Rule
The issue `#114` implementation gate passes for one bounded repair phase:

- route `/ask/*` to `/assistant` while preserving hash intent
- centralize backend crop normalization and use normalized crop keys before runtime state lookups
- align advisor tab frontend registry, backend orchestration entrypoints, and knowledge catalog delegate routes around canonical hyphenated harvest-market public routes while retaining underscore alias acceptance
- surface backend market-price fallback/degraded state in frontend types and UI
- add focused frontend/backend tests for the repaired contracts

It does not authorize:

- generated API client migration
- broad FastAPI response-model conversion
- new actuator-control endpoints
- simulation-default dataset/timestep service redesign
- redesigning the shell or changing visible navigation hierarchy

## Current Assessment
- Focused frontend regressions for `/ask/*`, advisor tab endpoint routing, SmartGrow knowledge route metadata, and produce fallback status passed.
- Focused backend regressions for crop normalization, advisor metadata, harvest-market orchestration entrypoint, overview signals, RTR state, and knowledge catalog passed.
- Full lint/test/build/pytest validation is still required before issue `#114` can be reported complete.
