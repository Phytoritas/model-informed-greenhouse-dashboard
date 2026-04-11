# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `issue100-sensor-freshness-runtime-recovery`
- sessionId: `model-informed-greenhouse-dashboard#fix-100-sensor-freshness-runtime-recovery`
- caseId: `case/model-informed-greenhouse-dashboard/fix-100-sensor-freshness-runtime-recovery`
- active issue: `#100`
- branch: `fix/100-fix-sensor-freshness-semantics-and-websocket-delay`

## Current State
- current_stage: `issue100-validating-pr101`
- implementation_gate: `validating`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `sensor freshness semantics split from replay timestamps, stalled runtime detection added, frontend auto-recovery and websocket reconnect hardened`
- latest_validation: `backend pytest/ruff and frontend vitest/lint/build passed locally, PR #101 is open, and GitHub CI succeeded on both push and pull_request`
- local_worktree_followup: `branch is clean; the remaining move is PR #101 review/merge plus the post-merge .rah sync issue on main`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#fix-100-sensor-freshness-runtime-recovery")
recall(
    keywords=["model-informed-greenhouse-dashboard", "issue100", "sensor-freshness", "runtime-recovery", "websocket", "stalled"],
    topic="issue100-sensor-freshness-runtime-recovery",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#fix-100-sensor-freshness-runtime-recovery",
    caseMode=True,
    depth="standard",
    contextText="resume issue #100 and finish the bounded sensor freshness and runtime recovery lane without mixing in blocked RTR calibration work"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Review and merge PR `#101` if the bounded issue100 diff is accepted.
- After merge, fast-forward local `main`, re-run the baseline checks if needed, and open the small docs sync issue for tracked `.rah` state.
- Keep blocked issue `#3` out of this lane.
