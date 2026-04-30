# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `frontend-ui-system`
- sessionId: `model-informed-greenhouse-dashboard#124:restore-tab-integrations-ui`
- caseId: `case/model-informed-greenhouse-dashboard/124/restore-tab-integrations-ui`
- active product issue: `#124`
- active docs sync issue: none
- branch: `fix/124-restore-tab-integrations-ui`
- active PR: `#125`
- blocked backlog issue: `#3`

## Current State
- current_stage: `issue124-backend-integration-restoration`
- implementation_gate: `open`
- active_slice: restore backend-backed workspace tabs and remove remaining compressed/legacy advisor route surfaces from production navigation.
- open_pr: `#125` on branch `fix/124-restore-tab-integrations-ui`.
- validation_baseline: frontend lint/build/test passed; direct venv Ruff and Pytest passed for backend source and tests.
- route_contract: `/`, `/overview`, and `/overview/legacy` render the standalone landing/overview surface; detailed backend-backed features remain in first-class workspace routes such as `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, `/settings`, and `/scenarios`.
- restored_aliases: `/growth/*`, `/nutrient/*`, `/protection/*`, and `/harvest/*` redirect into canonical workspace tabs instead of rendering detached legacy advisor pages.
- design_evidence: reference and comparison assets live under `docs/design/`, including Command, Dashboard, Watch, tablet, and mobile screenshots.

## Read First
1. nearest `AGENTS.md`
2. `Phytoritas.md`
3. `docs/architecture/Phytoritas.md`
4. `docs/design/codex_image_based_greenhouse_ui_prompt.md`
5. `.rah/state/status.json`
6. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#124:restore-tab-integrations-ui")
recall(
    keywords=["model-informed-greenhouse-dashboard", "frontend-ui-system", "issue124", "issue125", "backend integration", "workspace tabs", "legacy aliases"],
    topic="frontend-ui-system",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#124:restore-tab-integrations-ui",
    caseMode=True,
    depth="standard",
    contextText="resume issue124 workspace tab integration restoration"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Review and push the current PR `#125` slice after confirming no unrelated user edits are included.
- Keep issue `#3` blocked until grower-approved RTR windows exist.
- Keep detailed backend features in dedicated workspace tabs rather than compressing them into Overview Command.
