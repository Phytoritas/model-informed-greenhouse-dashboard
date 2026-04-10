# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `architecture-refactor`
- sessionId: `model-informed-greenhouse-dashboard#main:post-issue84-merged-baseline`
- caseId: `case/model-informed-greenhouse-dashboard/main/post-issue84-merged-baseline`
- issue: `none`
- branch: `main`

## Current State
- current_stage: `main-post-issue84-merged-baseline`
- implementation_gate: `post-issue84-merged-baseline`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue65 compact shell -> issue67 compact control summary -> issue69 control copy cleanup -> issue74 residual copy cleanup -> issue80 layout overlap cleanup -> issue82 narrow-rail clipping follow-up -> issue84 control realtime recovery`
- latest_validation: `issue84 merged on main after a green local ladder and green GitHub Actions Backend/Frontend validation`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#main:post-issue84-merged-baseline")
recall(
    keywords=["model-informed-greenhouse-dashboard", "architecture-refactor", "main", "post-issue84-merged-baseline"],
    topic="architecture-refactor",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#main:post-issue84-merged-baseline",
    caseMode=True,
    depth="standard",
    contextText="post-merge baseline intake before the next issue-driven loop"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Treat `main` as the only truthful post-issue84 baseline.
- Keep issue `#88` bounded to blueprint/backlog sync only, and keep issue `#84` retired.
- Keep issue `#3` blocked until real grower-approved tomato/cucumber production windows are supplied.
- Start any unrelated non-trivial change from a fresh issue-based branch.
- Keep the current route ids, section hashes, `/rtr` compatibility, and API contracts untouched unless a future issue explicitly reopens those seams.
