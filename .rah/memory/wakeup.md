# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `frontend-ui-system`
- sessionId: `model-informed-greenhouse-dashboard#120:sync-issue118-merged-harness-state`
- caseId: `case/model-informed-greenhouse-dashboard/120/sync-issue118-merged-harness-state`
- active product issue: none
- active docs sync issue: none
- branch: `main`
- blocked backlog issue: `#3`

## Current State
- current_stage: `post-issue118-merged-baseline`
- implementation_gate: `closed`
- completed_issue118: image-informed `/overview` landing UI system, tabbed workspace restoration, Assistant/Ask redesign, book-like knowledge result pages, farmer-friendly answer summaries, and pesticide focus-target buttons.
- merged_pr: `#119` merged into `main` at `dfd68cdc2da0acd13bd37f2d47558e12757602f7`.
- closed_issue: `#118`; Project status is `Done`.
- validation_baseline: local frontend lint/build/test, `git diff --check`, and GitHub Actions Backend/Frontend validation passed on PR `#119`.
- route_contract: `/`, `/overview`, and `/overview/legacy` render the standalone landing/overview surface; detailed backend-backed features remain in first-class workspace routes such as `/control`, `/rtr`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, `/settings`, and `/scenarios`.
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
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#120:sync-issue118-merged-harness-state")
recall(
    keywords=["model-informed-greenhouse-dashboard", "frontend-ui-system", "issue118", "issue119", "overview", "assistant", "pesticide", "post-merge"],
    topic="frontend-ui-system",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#120:sync-issue118-merged-harness-state",
    caseMode=True,
    depth="standard",
    contextText="resume from clean post-issue118 merged main baseline"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Leave issue `#3` blocked until grower-approved RTR windows exist.
- Do not reopen issue `#118`; create a new issue for any follow-up UI, backend, or calibration work.
- Use `docs/design/current-overview-*.png` as the latest issue118 visual regression evidence.
