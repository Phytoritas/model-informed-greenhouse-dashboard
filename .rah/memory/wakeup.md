# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `backend-frontend-integration`
- sessionId: `model-informed-greenhouse-dashboard#116:docs-116-sync-issue114-merged-harness-state-on-main`
- caseId: `case/model-informed-greenhouse-dashboard/116/docs-116-sync-issue114-merged-harness-state-on-main`
- active product issue: none
- active docs sync issue: `#116`
- branch: `docs/116-sync-issue114-merged-harness-state-on-main`
- blocked backlog issue: `#3`

## Current State
- current_stage: `post-issue114-merged-baseline`
- implementation_gate: `closed`
- agents_and_workflow_gate: `satisfied`
- completed_issue114: `nested /ask/* alias routing; backend crop normalization consistency; advisor tab harvest-market route metadata; duplicate advisor planned-tab endpoint map removal; produce-price fallback source status`
- validation_baseline: `local frontend/backend ladder passed; GitHub Actions Backend/Frontend checks passed on PR #115`

## Read First
1. nearest `AGENTS.md`
2. `Phytoritas.md`
3. `docs/architecture/Phytoritas.md`
4. `.rah/state/status.json`
5. `.rah/state/gates.json`
6. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#116:docs-116-sync-issue114-merged-harness-state-on-main")
recall(
    keywords=["model-informed-greenhouse-dashboard", "backend-frontend-integration", "issue114", "post-merge", "validation"],
    topic="backend-frontend-integration",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#116:docs-116-sync-issue114-merged-harness-state-on-main",
    caseMode=True,
    depth="standard",
    contextText="resume from clean post-issue114 merged main baseline"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Finish docs sync issue `#116`, then leave `main` with no active product implementation issue.
- Do not expand into generated API clients, broad response models, simulation-default redesign, or quick-control actuator endpoints without a new issue.
- Keep issue `#3` blocked unless grower-approved windows are supplied.
