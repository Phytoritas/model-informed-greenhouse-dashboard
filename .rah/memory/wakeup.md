# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `architecture-refactor`
- sessionId: `model-informed-greenhouse-dashboard#69:fix-69-clean-remaining-control-copy-residue-after-compact-shell`
- caseId: `case/model-informed-greenhouse-dashboard/69/fix-69-clean-remaining-control-copy-residue-after-compact-shell`
- issue: `#69`
- branch: `fix/69-clean-remaining-control-copy-residue-after-compact-shell`

## Current State
- current_stage: `issue69-control-copy-cleanup`
- implementation_gate: `issue69-copy-polish-phase`
- agents_and_workflow_gate: `satisfied`
- latest_route_slice: `issue65 merged compact shell -> issue67 compact control summary -> issue69 control copy polish`
- latest_validation: `The issue69 copy-only `/control` polish stayed green locally with frontend lint/test/build, repo ruff/pytest, and a fresh `/control` screenshot at artifacts/screenshots/issue69-control-copy-cleanup-final.png.`

## Read First
1. nearest `AGENTS.md`
2. `docs/architecture/Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#69:fix-69-clean-remaining-control-copy-residue-after-compact-shell")
recall(
    keywords=["model-informed-greenhouse-dashboard", "architecture-refactor", "issue69", "control-copy", "weather-copy", "route-meta"],
    topic="architecture-refactor",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#69:fix-69-clean-remaining-control-copy-residue-after-compact-shell",
    caseMode=True,
    depth="standard",
    contextText="issue69 control copy cleanup follow-up after issue67 merged"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Treat the merged issue67 compact summary as the donor baseline and keep issue69 scoped to the `/control` copy-only residue.
- Commit and push the copy-cleanup slice, then open the issue69 PR with `artifacts/screenshots/issue69-control-copy-cleanup-final.png` and the latest local validation results.
