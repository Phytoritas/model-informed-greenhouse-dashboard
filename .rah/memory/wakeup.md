# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `architecture-refactor`
- sessionId: `model-informed-greenhouse-dashboard#main:post-issue74-merged-baseline`
- caseId: `case/model-informed-greenhouse-dashboard/main/post-issue74-merged-baseline`
- issue: `80`
- branch: `fix/80-realign-overlapping-layout-tiles-and-panels`

## Current State
- current_stage: `issue80-layout-overlap-fix`
- implementation_gate: `local-validation-green`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue65 compact shell -> issue67 compact control summary -> issue69 control copy cleanup -> issue74 residual copy cleanup -> issue80 layout overlap cleanup in progress`
- latest_validation: `issue80 local ladder green with overview/crop-work layout simplification, compact overview charts, and fresh Playwright screenshots`

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
- Resume issue `#80` on branch `fix/80-realign-overlapping-layout-tiles-and-panels` and keep the scope bounded to layout overlap removal plus compact overview charting.
- Keep the current route ids, section hashes, `/rtr` compatibility, and optimizer contracts untouched unless a future issue explicitly reopens them.
- If validation stays green, the next move is commit -> push -> PR for issue `#80`; do not widen the branch into unrelated control copy or backend fetch-error cleanup.
