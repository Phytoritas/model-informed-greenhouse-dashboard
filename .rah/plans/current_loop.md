# Current Loop

## Active State
- Issue `#114` is the active bounded post-issue112 backend/frontend integration repair lane.
- Active branch: `fix/114-post-issue112-backend-frontend-integration-audit`.
- Issue `#112` is complete and merged into `main`; its RTR crop casing, RTR crop typing, KRW/kWh fallback, and AdvisorTabs lane regressions are preservation constraints.
- The blocked calibration backlog remains issue `#3`, waiting for grower-approved RTR windows.

## Stable Main Baseline
- PR `#113` merged issue `#112` into `main` at `079e373`.
- The merged baseline includes:
  - RTR area-settings crop casing repair and backend tolerance
  - RTR response/calibration crop key alignment
  - KRW/kWh frontend fallback alignment with backend settings
  - exact and nested `/growth`, `/nutrient`, `/protection`, and `/harvest` advisor lane access
  - full local and GitHub CI validation for the issue `#112` slice

## Current Repair Slice
- `/ask/*` aliases now redirect to `/assistant` while preserving hash intent.
- Backend crop validation now normalizes valid title-case/whitespace crop inputs and route handlers use normalized crop keys before state/service access.
- SmartGrow advisor route metadata now uses canonical `/api/advisor/tab/harvest-market` for the public harvest-market route while keeping underscore alias acceptance.
- Frontend advisor planned-tab execution now reads route paths from the advisor tab registry source of truth.
- Produce-price fallback payloads now expose `auth_mode="fallback"` and fallback reason/status in frontend types and visible source-status UI.

## Latest Validation
- Focused frontend regression run passed:
  - `npm --prefix frontend run test -- App.routing.test.tsx ProducePricesPanel.test.tsx useSmartGrowAdvisor.test.tsx useSmartGrowKnowledge.test.tsx`
- Focused backend regression run passed:
  - `poetry run pytest tests/test_smoke.py::test_knowledge_status_endpoint_returns_crop_scoped_catalog tests/test_smoke.py::test_advisor_tab_endpoint_forwards_greenhouse_id tests/test_advisory.py::test_knowledge_catalog_exposes_advisory_surfaces tests/test_advisor_orchestration.py::test_build_advisor_tab_response_lands_harvest_market_with_dashboard_context tests/test_model_runtime_api.py::test_overview_signal_endpoint_returns_internal_irradiance_and_model_history tests/test_rtr_optimizer.py::test_rtr_state_route_returns_canonical_shape`
- Full validation ladder is still required before PR packaging.

## Exact Next Step
1. Run the full repo validation ladder.
2. Run `git diff --check` and RAH `doctor|status|resume`.
3. Record Memento feedback/reflect for issue `#114`.
4. Commit, push, open PR with `Closes #114`, and merge only after validation passes.
