# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `architecture-refactor`
- sessionId: `model-informed-greenhouse-dashboard#61:hyp-61-rebuild-phytosync-into-coral-stay-routed-shell`
- caseId: `case/model-informed-greenhouse-dashboard/61/hyp-61-rebuild-phytosync-into-coral-stay-routed-shell`
- issue: `61`
- branch: `hyp/61-rebuild-phytosync-into-coral-stay-routed-shell`

## Current State
- current_stage: `issue61-assistant-alias-canonicalized`
- implementation_gate: `open-for-bounded-phases`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `assistant-alias-canonicalized`
- latest_validation: `full local ladder + rah.py doctor|status|resume rerun on 2026-04-10; doctor is warn-only for missing hooks and optional deployment.json`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#61:hyp-61-rebuild-phytosync-into-coral-stay-routed-shell")
recall(
    keywords=["model-informed-greenhouse-dashboard", "architecture-refactor", "hyp/61-rebuild-phytosync-into-coral-stay-routed-shell", "issue-61"],
    topic="architecture-refactor",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#61:hyp-61-rebuild-phytosync-into-coral-stay-routed-shell",
    caseMode=True,
    depth="standard",
    contextText="bootstrap -> recon -> architecture intake"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Keep `ask-*` panel/hash normalization as inbound compatibility until after the first issue `#61` PR, and use the existing `/ask#...` plus `assistant#ask-*` regressions as the guardrail against accidental removal.
- The next bounded step is PR bundling and shell polish, not alias retirement.
