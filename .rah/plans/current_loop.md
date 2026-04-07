# Current Loop

## Active State
- No active bounded implementation loop is open right now.
- Issue `#21` is merged into `main` via PR `#22`, and the local plus GitHub validation lanes are green.

## Latest Delivered Baseline
- Issue `#19` remains the model-first SmartGrow foundation baseline on `main`.
- Issue `#21` adds persisted work-event compare read paths, directive-aligned `/api/advisor/work-tradeoff`, crop-specific cucumber/tomato agronomy/ranking, richer `WorkTab` compare fields, and a minimal Vitest/RTL component harness for `work_event_compare`.
- The merged validation ladder for the delivered baseline is:
  - `poetry run ruff check .`
  - `poetry run pytest`
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`

## Exact Restart Step
1. Stay on `main` until a new non-trivial task is scoped.
2. Before more architecture or implementation work, open a new issue and branch so the repo-local issue-first gate stays true.
3. Treat the current `work_event_compare` backend contract and `WorkTab` compare surface as fixed merged baseline; do not reopen them casually under an unrelated issue.
4. The strongest candidate next loops are:
   - advisor service split behind the currently orchestrator-centric exact routes
   - deeper scenario/sensitivity consumption in advisor ranking
   - broader reuse of work-event compare outside the `work` tab if there is a clear product need
5. Keep issue `#3` isolated as the separate blocked RTR follow-up lane.
