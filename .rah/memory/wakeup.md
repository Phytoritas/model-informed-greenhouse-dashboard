# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `backend-frontend-integration`
- sessionId: `model-informed-greenhouse-dashboard#adhoc:post-issue112-integration-audit`
- caseId: `case/model-informed-greenhouse-dashboard/114/post-issue112-backend-frontend-integration-audit`
- active issue: `#114`
- branch: `fix/114-post-issue112-backend-frontend-integration-audit`
- blocked backlog issue: `#3`

## Current State
- current_stage: `issue114-post-issue112-backend-frontend-integration`
- implementation_gate: `passed-for-bounded-phase`
- agents_and_workflow_gate: `satisfied`
- confirmed_gaps: `nested /ask/* alias routing; backend crop normalization consistency; advisor tab harvest-market route metadata; duplicate advisor planned-tab endpoint map; produce-price fallback source status hidden in frontend`
- validation_needed: `full frontend lint/test/build, backend ruff/pytest, git diff check, and RAH doctor/status/resume`

## Read First
1. nearest `AGENTS.md`
2. `Phytoritas.md`
3. `docs/architecture/implementation/implementation_gate_checklist.md`
4. `.rah/state/status.json`
5. `.rah/state/gates.json`
6. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#adhoc:post-issue112-integration-audit")
recall(
    keywords=["model-informed-greenhouse-dashboard", "backend-frontend-integration", "issue114", "ask", "crop", "advisor", "produce fallback"],
    topic="backend-frontend-integration",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#adhoc:post-issue112-integration-audit",
    caseMode=True,
    depth="standard",
    contextText="resume issue 114 post-issue112 backend/frontend integration repair"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Continue issue `#114` from the full validation phase.
- Do not expand into generated API clients, broad response models, simulation-default redesign, or quick-control actuator endpoints without a new gate.
- Keep issue `#3` blocked unless grower-approved windows are supplied.
