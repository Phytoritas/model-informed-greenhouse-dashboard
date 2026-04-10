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
- implementation_gate: `phase-1-shell-route-refactor`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue61-merged-baseline -> issue65 compact shell simplification`
- latest_validation: `The preserved baseline remains green from the merged issue61 loop; issue65 is now in blueprint/shell refactor mode and has not yet completed the new frontend ladder.`

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
- Keep issue `#65` focused on shell reduction first: five visible pages, hidden assistant/settings routes, and `/rtr` normalized into control.
- Then relayout overview/control into the bounded compact tile canvas before expanding the same layout system to crop-work/resources/alerts.
