# Current Loop

## Earliest Pending Gate
- `work_event_compare_loop` is now the active pending gate for issue `#21`
- The current `work` advisor already shows control-scenario compare through the shared `model_runtime` panel, but it still depends on deterministic planning heuristics and has no event-sourced compare payloads over persisted `crop_work_events`

## Landed Before This Loop
- Issue `#19` is merged into `main` at `ecbd9b7` via PR `#20`, so the model-first runtime foundations, additive advisor contracts, model-aware frontend surfaces, knowledge/advisor CI hardening, and weather-panel resilience are now the fixed baseline
- Issue `#18` is closed as a preserved compatibility baseline after its knowledge/RAG/advisor surfaces were kept stable through the issue `#19` delivery
- Existing backend seams already include `crop_work_events`, canonical `leaf_removal` and `fruit_thinning` event application, `/api/models/snapshot|replay|scenario|sensitivity`, and additive `machine_payload.model_runtime` envelopes across summary, tabs, and chat

## Exact Restart Step
1. Continue on issue `#21` and branch `feat/21-implement-work-event-driven-compare-loop-for-smartgrow-advisor-tradeoffs`.
2. Keep issue `#19` merged mainline and issue `#18` compatibility surfaces fixed; do not regress existing summary/chat/tab runtime consumers while extending the work-tradeoff path.
3. Use `model_state_store.py`, cucumber/tomato work-event application helpers, `advisor_orchestration.py`, and `frontend/src/components/advisor/WorkTab.tsx` as the bounded recon set for this loop.
4. Add a store/service read path for persisted `crop_work_events`, then define the first backend compare contract that turns history plus synthetic candidate `leaf_removal` / `fruit_thinning` actions into explicit replay-diff option payloads with shared snapshot provenance and confidence-aware guardrails.
5. Keep the existing control-based `AdvisorModelRuntimePanel` intact and add targeted backend contract tests before introducing a separate work-event compare block in the frontend.
6. Keep issue `#3` isolated as the separate blocked RTR follow-up lane.
