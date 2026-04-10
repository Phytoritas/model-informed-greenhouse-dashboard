# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `architecture-refactor`
- sessionId: `model-informed-greenhouse-dashboard#67:hyp-67-simplify-legacy-control-strategy-surface-into-a-tile-native-summary`
- caseId: `case/model-informed-greenhouse-dashboard/67/hyp-67-simplify-legacy-control-strategy-surface-into-a-tile-native-summary`
- issue: `#67`
- branch: `hyp/67-simplify-legacy-control-strategy-surface-into-a-tile-native-summary`

## Current State
- current_stage: `issue67-compact-control-summary`
- implementation_gate: `issue67-compact-summary-phase`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue65 merged compact shell -> issue67 control summary follow-up`
- latest_validation: `The compact control summary/table slice is green locally with frontend lint/test/build, repo ruff/pytest, and a fresh /control Playwright screenshot.`

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
    keywords=["model-informed-greenhouse-dashboard", "architecture-refactor", "issue67", "control-summary", "compact-control"],
    topic="architecture-refactor",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#67:hyp-67-simplify-legacy-control-strategy-surface-into-a-tile-native-summary",
    caseMode=True,
    depth="standard",
    contextText="issue67 compact control summary follow-up after issue65 merged"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Treat the merged issue65 shell as the donor baseline and keep issue67 scoped to the `/control` legacy strategy surface only.
- Commit and push the compact summary/table slice, then open the issue67 PR with the new `/control` screenshot and local validation results.
