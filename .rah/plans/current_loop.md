# Current Loop

## Active State
- `main` is the truthful post-issue100 merged baseline.
- No active product implementation branch is open in the repository.
- The only open tracked backlog issue is blocked issue `#3`, which still waits for grower-approved RTR windows.

## Stable Main Baseline
- PR `#95` merged issue `#94` into `main` at `ff0a92a`.
- PR `#97` merged issue `#96` into `main` at `daaef46`.
- PR `#101` merged issue `#100` into `main` at `6356829`.
- The merged baseline now includes:
  - frontend dashboard follow-up polish and the cucumber overview photo asset
  - precision-ladder advisor recommendations with bounded scenario verification
  - additive OpenAI-ready runtime payloads and regression tests
  - sensor freshness based on actual transport receipt time rather than replay timestamps
  - stalled simulation task detection, paused-state protection, websocket reconnect recovery, and broadcast-set race protection

## Latest Validation
- The merged issue100 branch stayed green on the full ladder:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --pool=threads`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
- GitHub Actions `CI` succeeded for both the `push` and `pull_request` runs on commit `a79916b`.
- Local smoke confirmed that `/api/status` returns immediately after single-backend restart, `last_error` clears, and the overview page reconnects the cucumber WebSocket after an offline transition.
- This repo does not currently contain `automation/rah.py`, so the docs-sync lane validates control-plane changes by re-reading tracked `.rah` files directly and running `git diff --check`.

## Exact Next Step
1. If working on RTR calibration, unblock issue `#3` with real grower-approved windows before opening its implementation branch.
2. Otherwise, start the next non-trivial task from a fresh issue-based branch off clean `main`.
