# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `issue106-overview-solution-and-irradiance-live-updates`
- sessionId: `model-informed-greenhouse-dashboard#fix-106-restore-overview-solution-and-irradiance-live-updates`
- caseId: `case/model-informed-greenhouse-dashboard/fix-106-restore-overview-solution-and-irradiance-live-updates`
- active issue: `#106`
- branch: `fix/106-restore-overview-solution-and-irradiance-live-updates`

## Current State
- current_stage: `issue106-overview-solution-and-irradiance-live-updates`
- implementation_gate: `pass`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue106 restores Today operating-direction freshness through receivedAt-based advisor auto-refresh gating and restores outside irradiance freshness through a dedicated shortwave-history cache TTL`
- latest_validation: `local ladder is green on npm lint/test/build plus ruff/pytest for the current issue106 follow-up set, including dedicated advisorAutoRefresh and weather-history regressions`
- local_worktree_followup: `the branch is committed, pushed, and attached to stacked PR #107 on top of PR #105; next step is to watch remote validation and merge in order`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#fix-106-restore-overview-solution-and-irradiance-live-updates")
recall(
    keywords=["model-informed-greenhouse-dashboard", "issue106-overview-solution-and-irradiance-live-updates", "issue106", "overview-solution", "irradiance"],
    topic="issue106-overview-solution-and-irradiance-live-updates",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#fix-106-restore-overview-solution-and-irradiance-live-updates",
    caseMode=True,
    depth="standard",
    contextText="resume the active issue106 follow-up branch for overview solution freshness and outside irradiance live updates on top of PR #105"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Keep work scoped to issue `#106` while PR `#107` validates on top of PR `#105`.
- Merge in stack order: issue104 / PR `#105` first, then issue106 / PR `#107`.
- Split any additional unrelated telemetry/performance work into another fresh issue after the stacked follow-up is merged.
