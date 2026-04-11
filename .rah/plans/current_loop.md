# Current Loop

## Active State
- Active implementation branch: `fix/100-fix-sensor-freshness-semantics-and-websocket-delay`.
- Active issue: `#100` (`[Bug] Fix sensor freshness semantics and websocket delay`).
- Current bounded scope: split replay timestamp vs transport freshness, detect stalled simulation tasks correctly, and auto-restart stale runtime streams from the frontend health loop.

## Stable Main Baseline
- PR `#95` merged issue `#94` into `main` at `ff0a92a`.
- PR `#97` merged issue `#96` into `main` at `daaef46`.
- The merged baseline now includes:
  - frontend dashboard follow-up polish and the cucumber overview photo asset
  - precision-ladder advisor recommendations with bounded scenario verification
  - additive OpenAI-ready runtime payloads and regression tests
  - tracked harness files synced through the post-issue94 mainline

## Latest Validation
- `npm --prefix frontend run lint`
- `npm --prefix frontend run test -- --pool=threads`
- `npm --prefix frontend run build`
- `poetry run ruff check .`
- `poetry run pytest`

## Exact Next Step
1. Review the issue `#100` diff for regressions, then commit and push the validated backend/frontend recovery fix.
2. Open a PR with evidence from `poetry run pytest`, `poetry run ruff check .`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`, and local WebSocket/runtime smoke.
3. Keep blocked issue `#3` out of this lane; resume it only from a separate branch when grower-approved RTR windows exist.
