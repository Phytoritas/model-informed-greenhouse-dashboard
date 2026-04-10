# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `architecture-refactor`
- sessionId: `model-informed-greenhouse-dashboard#65:hyp-65-simplify-phytosync-ui-into-a-compact-coral-tile-shell`
- caseId: `case/model-informed-greenhouse-dashboard/65/hyp-65-simplify-phytosync-ui-into-a-compact-coral-tile-shell`
- issue: `#65`
- branch: `hyp/65-simplify-phytosync-ui-into-a-compact-coral-tile-shell`

## Current State
- current_stage: `issue65-compact-coral-tile-shell`
- implementation_gate: `validation-and-pr-review`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue61-merged-baseline -> issue65 compact shell simplification`
- latest_validation: `Issue65 follow-up polish remains green after frontend lint/test/build, and PR #66 checks are already passing. The remaining decision is whether the legacy control strategy surface needs a follow-up issue or closes as residual debt.`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#65:hyp-65-simplify-phytosync-ui-into-a-compact-coral-tile-shell")
recall(
    keywords=["model-informed-greenhouse-dashboard", "architecture-refactor", "issue65", "compact-shell", "coral-tile"],
    topic="architecture-refactor",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#65:hyp-65-simplify-phytosync-ui-into-a-compact-coral-tile-shell",
    caseMode=True,
    depth="standard",
    contextText="issue65 compact coral tile shell intake before route and page relayout"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Treat the five-page shell, hidden assistant/settings routes, `/rtr` redirect, assistant drawer, and first tile relayout as landed for issue `#65`.
- Use PR `#66` review to decide whether the remaining legacy control strategy surface deserves a separate follow-up issue or can remain as accepted debt under the current validating PR.
