# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `issue104-live-refresh-source-sink-sync`
- sessionId: `model-informed-greenhouse-dashboard#fix-104-live-refresh-source-sink-sync`
- caseId: `case/model-informed-greenhouse-dashboard/fix-104-live-refresh-source-sink-sync`
- active issue: `#104`
- branch: `fix/104-restore-live-refresh-responsiveness-and-overview-source-sink-sync`

## Current State
- current_stage: `issue104-live-refresh-source-sink-sync`
- implementation_gate: `pass`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue104 restores live refresh responsiveness, filters overview source-sink history to live-created snapshots, prevents inactive crop RTR fan-out, and makes overview source-sink surfaces consume live values`
- latest_validation: `local ladder is green on npm lint/test/build plus ruff/pytest for the current issue104 fix set`
- local_worktree_followup: `the branch is not yet committed or attached to a PR; next clean GitHub step is commit -> push -> PR`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#fix-104-live-refresh-source-sink-sync")
recall(
    keywords=["model-informed-greenhouse-dashboard", "issue104-live-refresh-source-sink-sync", "issue104", "live-refresh", "source-sink"],
    topic="issue104-live-refresh-source-sink-sync",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#fix-104-live-refresh-source-sink-sync",
    caseMode=True,
    depth="standard",
    contextText="resume the active issue104 bugfix branch for live refresh responsiveness and overview source-sink sync"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Keep work scoped to issue `#104` until the validated bugfix set is committed.
- Open a PR from `fix/104-restore-live-refresh-responsiveness-and-overview-source-sink-sync` once the local diff is finalized.
- Split any additional unrelated follow-up into a fresh issue/branch after PR creation.
