# Current Loop

## Earliest Pending Gate
- `issue21_pr_validation` is now the active pending gate for issue `#21`
- The additive work-event compare slice, reviewer hardening, crop-specific candidate agronomy/ranking, backend matrix tests, and dedicated `WorkTab` component coverage are all landed; the remaining work is PR validation and review

## Landed Before This Loop
- Issue `#19` is merged into `main` at `ecbd9b7` via PR `#20`, so the model-first runtime foundations, additive advisor contracts, model-aware frontend surfaces, knowledge/advisor CI hardening, and weather-panel resilience are now the fixed baseline
- Issue `#18` is closed as a preserved compatibility baseline after its knowledge/RAG/advisor surfaces were kept stable through the issue `#19` delivery
- Existing backend seams already include `crop_work_events`, canonical `leaf_removal` and `fruit_thinning` event application, `/api/models/snapshot|replay|scenario|sensitivity`, and additive `machine_payload.model_runtime` envelopes across summary, tabs, and chat

## Landed In This Loop
- `ModelStateStore` now exposes `load_current_state()` and `list_work_events()` so persisted work metadata can be read back instead of only being written
- The `work` advisor now emits additive `machine_payload.work_event_compare` payloads that replay the latest stored snapshot into maintain / candidate-event / defer options for cucumber `leaf_removal` and tomato `fruit_thinning`
- `WorkTab` now renders a dedicated work-event compare block beside the existing control-scenario runtime panel instead of overloading `AdvisorModelRuntimePanel`
- Hardening fixes now keep replay compare greenhouse-scoped, tolerate malformed persisted event payloads without taking down the whole work tab, degrade cleanly when the state store is unavailable, and lock the request contract with a `/api/advisor/tab/work` greenhouse-forwarding smoke test
- Exact additive `/api/advisor/environment`, `/api/advisor/physiology`, `/api/advisor/work-tradeoff`, and `/api/advisor/harvest` routes now exist over the same model-aware tab surfaces, `/api/advisor/work-tradeoff` flattens `work_event_compare` into the directive-aligned top-level tradeoff contract, and `/api/knowledge/status` now advertises the exact routes alongside the preserved legacy seams
- Cucumber work-event compare now enforces a 15-leaf guard, surfaces agronomy flags plus 14-day fruit-DM/LAI deltas, and matrix-tests 12/15/18 leaf scenarios so over-defoliation stays out of the recommended path
- Tomato work-event compare now scores maintain / thin / defer / next-truss planning options with sink-overload-aware ranking, exposes sink-overload state in the compare payload, and matrix-tests lighter versus heavier fruit-load cases so `1과 감과` only rises when overload pressure is real
- The frontend typed contract now absorbs the richer work-event compare fields and `WorkTab` renders the new agronomy flags, 14-day fruit-DM delta, 14-day LAI delta, leaf guard, and sink-overload values without breaking the existing work surface
- A minimal frontend Vitest/RTL harness now exists for `WorkTab` `work_event_compare`, covering the landed agronomy-detail path and the `history-unavailable` fallback path
- Validated: `poetry run ruff check .`, `poetry run pytest`, `npm --prefix frontend run test`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`

## Exact Restart Step
1. Continue on issue `#21` and branch `feat/21-implement-work-event-driven-compare-loop-for-smartgrow-advisor-tradeoffs`.
2. Keep issue `#19` merged mainline and issue `#18` compatibility surfaces fixed; do not regress existing summary/chat/tab runtime consumers while extending the work-tradeoff path.
3. Treat the current backend compare contract and `WorkTab` compare block as the new baseline; do not fold it back into the generic control-scenario runtime panel.
4. Crop-specific candidate generation and ranking are now the baseline; do not revert the 15-leaf cucumber guard, sink-overload-aware tomato ordering, additive compare detail fields, or the new `WorkTab` component harness without replacing them with stricter protection.
5. Keep PR `#22` as the active delivery surface for issue `#21`; the next work should be review/CI follow-through unless a reviewer finds a concrete regression.
6. If another follow-up slice is needed after review, open a new bounded issue rather than silently stretching issue `#21` back into broad architecture work.
7. Keep issue `#3` isolated as the separate blocked RTR follow-up lane.
