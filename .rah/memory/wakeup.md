# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `issue-92-overview`
- sessionId: `model-informed-greenhouse-dashboard#fix-92-overview:validating`
- caseId: `case/model-informed-greenhouse-dashboard/fix-92-overview/issue-92`
- issue: `#92`
- branch: `fix/92-overview`

## Current State
- current_stage: `issue92-validating`
- implementation_gate: `issue92-validating`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue92 overview restoration -> real overview signal history -> routed shell/topbar/search cleanup -> control/overview lane polish -> RTR state persistence hardening`
- latest_validation: `local ladder is green on fix/92-overview with ruff, pytest, frontend lint, frontend vitest, and frontend build`
- local_worktree_followup: `the branch is already issue-linked; the remaining step is GitHub workflow completion (commit/push/PR) without widening scope`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#fix-92-overview:validating")
recall(
    keywords=["model-informed-greenhouse-dashboard", "issue-92-overview", "fix/92-overview", "validating"],
    topic="issue-92-overview",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#fix-92-overview:validating",
    caseMode=True,
    depth="standard",
    contextText="resume the validated issue #92 overview/control recovery branch and complete GitHub workflow hygiene"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Commit the validated issue `#92` slice on `fix/92-overview`.
- Push the branch and create the PR that includes `Closes #92`.
- Keep the project item in `Validating` until the remote review/merge step finishes.
- Do not broaden this branch beyond issue `#92`; open a fresh issue/branch from `main` for any new follow-up.
