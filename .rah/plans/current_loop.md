# Current Loop

## Earliest Pending Gate
- `work_event_compare_hardening` is now the active pending gate for issue `#21`
- The first additive work-event compare slice is landed and reviewer hardening is in place, but candidate depth, dedicated component coverage, and broader reuse are still follow-up work

## Landed Before This Loop
- Issue `#19` is merged into `main` at `ecbd9b7` via PR `#20`, so the model-first runtime foundations, additive advisor contracts, model-aware frontend surfaces, knowledge/advisor CI hardening, and weather-panel resilience are now the fixed baseline
- Issue `#18` is closed as a preserved compatibility baseline after its knowledge/RAG/advisor surfaces were kept stable through the issue `#19` delivery
- Existing backend seams already include `crop_work_events`, canonical `leaf_removal` and `fruit_thinning` event application, `/api/models/snapshot|replay|scenario|sensitivity`, and additive `machine_payload.model_runtime` envelopes across summary, tabs, and chat

## Landed In This Loop
- `ModelStateStore` now exposes `load_current_state()` and `list_work_events()` so persisted work metadata can be read back instead of only being written
- The `work` advisor now emits additive `machine_payload.work_event_compare` payloads that replay the latest stored snapshot into maintain / candidate-event / defer options for cucumber `leaf_removal` and tomato `fruit_thinning`
- `WorkTab` now renders a dedicated work-event compare block beside the existing control-scenario runtime panel instead of overloading `AdvisorModelRuntimePanel`
- Hardening fixes now keep replay compare greenhouse-scoped, tolerate malformed persisted event payloads without taking down the whole work tab, degrade cleanly when the state store is unavailable, and lock the request contract with a `/api/advisor/tab/work` greenhouse-forwarding smoke test
- Validated: `poetry run ruff check .`, `poetry run pytest`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`

## Exact Restart Step
1. Continue on issue `#21` and branch `feat/21-implement-work-event-driven-compare-loop-for-smartgrow-advisor-tradeoffs`.
2. Keep issue `#19` merged mainline and issue `#18` compatibility surfaces fixed; do not regress existing summary/chat/tab runtime consumers while extending the work-tradeoff path.
3. Treat the current backend compare contract and `WorkTab` compare block as the new baseline; do not fold it back into the generic control-scenario runtime panel.
4. Next hardening slice should tighten candidate generation and ranking, especially around cucumber minimum leaf-count behavior and tomato cohort selection heuristics.
5. Frontend component coverage for `work_event_compare` is still absent because the repo currently has no frontend test harness beyond lint/build; decide whether to introduce a minimal Vitest/RTL setup as a separate bounded slice or keep relying on API/backend smoke for issue `#21`.
6. Decide whether to open the issue `#21` PR now or after one more bounded polish slice.
7. Keep issue `#3` isolated as the separate blocked RTR follow-up lane.
