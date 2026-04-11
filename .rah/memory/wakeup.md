# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `main-clean-issue3-blocked`
- sessionId: `model-informed-greenhouse-dashboard#main:issue3-blocked`
- caseId: `case/model-informed-greenhouse-dashboard/main/issue3-blocked`
- open backlog issue: `#3`
- branch: `main`

## Current State
- current_stage: `main-clean-issue3-blocked`
- implementation_gate: `blocked`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue94 merged -> issue96 merged -> issue100 merged -> main clean -> blocked RTR calibration backlog remains`
- latest_validation: `the merged main baseline is green on local validation ladders and issue100 GitHub CI`
- local_worktree_followup: `main is clean; new work should start from a fresh issue-based branch`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#main:issue3-blocked")
recall(
    keywords=["model-informed-greenhouse-dashboard", "main-clean-issue3-blocked", "main", "issue3", "blocked"],
    topic="main-clean-issue3-blocked",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#main:issue3-blocked",
    caseMode=True,
    depth="standard",
    contextText="resume from the clean main baseline and decide whether to unblock issue #3 or start a fresh issue-based branch"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Unblock issue `#3` only when grower-approved windows are available.
- For unrelated work, stay on clean `main` and open a new issue/branch first.
- Keep blocked issue `#3` out of this lane.
