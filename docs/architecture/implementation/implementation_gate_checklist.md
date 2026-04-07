# Implementation Gate Checklist

Implementation for issue `#19` is allowed only when the following items are explicit:

- [x] Active issue and issue-based branch exist for the new requirement
- [x] Root blueprint reflects the model-first SmartGrow loop
- [x] Workspace audit records the preserved issue `#18` baseline versus the new issue `#19` mainline
- [x] System brief defines the target packages, tables, APIs, and first bounded slice
- [x] ADR-001 records the model-first, RAG-explained decision
- [x] Module-001 records the phase-1 state/event/runtime boundary
- [x] Existing dashboard/runtime preservation constraints are explicit
- [x] Validation ladder and mandatory targeted tests are explicit
- [x] The phase-1 persistence-adapter choice is frozen in code
- [x] The phase-1 migration seam from current advisor shells into `/api/models/*` state contracts is spike-validated or landed

## Pass Rule
The issue `#19` implementation gate now passes for the bounded backend foundation through additive advisor-contract realignment.
That pass authorizes model-state, snapshot, replay, reusable physiology services, bounded scenario/sensitivity runtime, additive advisor-contract expansion, and the first shared frontend model-runtime surface.
It now also covers dashboard summary runtime surfacing and weather-resilient outside-context loading.
It does not yet authorize optimizer work or the final work-event-driven compare UI.

## Current Assessment
- The architecture is now aligned around issue `#19`, and the old issue `#18` nutrient/retrieval follow-up is no longer the active mainline.
- The bounded phase-1 seam is landed in code through adapter-backed `crop_models/`, the dedicated SQLite `model_state_store`, and `POST /api/models/snapshot` plus `POST /api/models/replay`.
- The bounded phase-2 backend runtime slice is now landed: reusable FvCB, Ball-Berry, and canopy-integration services feed the cucumber/tomato snapshot wrappers, and additive `POST /api/models/scenario` plus `POST /api/models/sensitivity` now persist trust-region-bounded scenario and finite-difference sensitivity outputs over the same snapshot seam.
- The additive advisor-contract realignment slice is now landed: `/api/advisor/*`, `/api/environment/recommend`, and `/api/work/recommend` preserve their current field names while attaching a model-first `machine_payload.model_runtime` block that is assembled from the new bounded scenario/sensitivity runtime.
- The first frontend counterfactual/model-aware surface slice is now landed: the `environment`, `physiology`, and `work` tabs render a shared `machine_payload.model_runtime` panel that exposes model state, leverage ranking, counterfactual compare, and constraint/missing-data guards without replacing the existing issue `#18` analysis and action cards.
- The `harvest_market` tab and Assistant/chat consumer slice are now landed: the tab consumes the shared runtime panel and chat replies keep a compact snapshot-aware runtime strip beside the existing natural-language answer.
- The dashboard-level `AiAdvisor` summary card is now aligned onto the same model-first payload family through a compact runtime strip, while `useAiAssistant` guards against stale summary responses during refreshes or crop switches.
- The live Daegu weather panel no longer hard-fails on Open-Meteo outages: backend weather fetches now fall back to cached or synthetic payloads and the frontend surfaces cached/fallback provider status explicitly instead of presenting degraded data as live.
- The issue `#19` validation ladder is green both locally and in GitHub Actions for PR `#20`, after hardening knowledge/advisory CI tests away from local-only workbook assumptions and closing the late-arriving produce-price summary refresh gap.
