# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `backend-frontend-integration`
- sessionId: `model-informed-greenhouse-dashboard#112:fix-112-backend-frontend-integration-audit-and-repair`
- caseId: `case/model-informed-greenhouse-dashboard/112/fix-112-backend-frontend-integration-audit-and-repair`
- active issue: `#112`
- branch: `fix/112-backend-frontend-integration-audit-and-repair`
- blocked backlog issue: `#3`

## Current State
- current_stage: `issue112-backend-frontend-integration`
- implementation_gate: `passed-for-bounded-phase`
- agents_and_workflow_gate: `satisfied`
- confirmed_gaps: `RTR area-settings crop casing; RTR response crop typing; RTR calibration response crop casing; KRW/kWh fallback unit drift; exact and nested advisor lane route access disconnected`
- validation_needed: `focused frontend/backend tests, lint/build, ruff/pytest, and git diff check`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#112:fix-112-backend-frontend-integration-audit-and-repair")
recall(
    keywords=["model-informed-greenhouse-dashboard", "backend-frontend-integration", "issue112", "rtr", "advisor", "validation"],
    topic="backend-frontend-integration",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#112:fix-112-backend-frontend-integration-audit-and-repair",
    caseMode=True,
    depth="standard",
    contextText="resume issue 112 backend/frontend integration repair"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Continue issue `#112` from the bounded implementation phase.
- Do not expand into response-model generation or quick-control actuator endpoints without a new gate.
- Keep issue `#3` blocked unless grower-approved windows are supplied.
