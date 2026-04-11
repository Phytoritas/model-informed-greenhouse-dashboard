# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `issue-94-runtime-dashboard-followup`
- sessionId: `model-informed-greenhouse-dashboard#fix-94-runtime-dashboard-followup:validating`
- caseId: `case/model-informed-greenhouse-dashboard/fix-94-runtime-dashboard-followup/issue-94`
- issue: `#94`
- branch: `fix/94-finalize-post-issue92-dashboard-polish-and-precision-runtime-recommendations`

## Current State
- current_stage: `issue94-validating`
- implementation_gate: `issue94-validating`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `frontend dashboard follow-up polish -> precision ladder model-runtime recommendations -> issue-linked GitHub workflow restoration`
- latest_validation: `local ladder is green on fix/94 with ruff, pytest, frontend lint, frontend vitest, and frontend build`
- local_worktree_followup: `PR #95 is open and the local worktree is clean; the remaining step is remote validation and merge completion`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#fix-94-runtime-dashboard-followup:validating")
recall(
    keywords=["model-informed-greenhouse-dashboard", "issue-94-runtime-dashboard-followup", "fix/94", "validating"],
    topic="issue-94-runtime-dashboard-followup",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#fix-94-runtime-dashboard-followup:validating",
    caseMode=True,
    depth="standard",
    contextText="resume issue #94 validating work, verify PR #95, and finish the merge-to-main workflow"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Watch PR `#95` until the remote validation checks pass.
- Merge PR `#95`, then fast-forward local `main`.
- Keep new follow-up scope off issue `#94`; start a fresh issue/branch from `main` if more product work appears.
