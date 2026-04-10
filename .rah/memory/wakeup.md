# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `architecture-refactor`
- sessionId: `model-informed-greenhouse-dashboard#main:post-issue74-merged-baseline`
- caseId: `case/model-informed-greenhouse-dashboard/main/post-issue74-merged-baseline`
- issue: `84`
- branch: `fix/84-fix-control-realtime-failures-and-user-facing-fetch-errors`

## Current State
- current_stage: `issue84-control-realtime-recovery`
- implementation_gate: `local-validation-green`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue65 compact shell -> issue67 compact control summary -> issue69 control copy cleanup -> issue74 residual copy cleanup -> issue80 layout overlap cleanup -> issue82 narrow-rail clipping follow-up -> issue84 control realtime recovery`
- latest_validation: `issue84 local ladder green with backend-origin recovery, request-error localization, and a fresh /control Playwright screenshot`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#main:post-issue74-merged-baseline")
recall(
    keywords=["model-informed-greenhouse-dashboard", "architecture-refactor", "main", "post-issue74-merged-baseline"],
    topic="architecture-refactor",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#main:post-issue74-merged-baseline",
    caseMode=True,
    depth="standard",
    contextText="post-merge baseline intake before the next issue-driven loop"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Resume issue `#84` on branch `fix/84-fix-control-realtime-failures-and-user-facing-fetch-errors` and keep the scope bounded to standard-local backend recovery plus grower-facing request-error copy in the control surfaces.
- Keep the current route ids, section hashes, `/rtr` compatibility, and API contracts untouched; treat the overlapping local uvicorn listeners on `8000` as an operational follow-up unless a separate issue explicitly reopens backend process hygiene.
- If validation stays green, the next move is commit -> push -> PR for issue `#84`; do not widen the branch into unrelated layout or shell refactors.
