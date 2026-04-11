# Current Loop

## Active State
- `main` is the truthful post-issue96 merged baseline.
- No active product implementation branch is open in the repository.
- The only open tracked backlog issue is blocked issue `#3`, which still waits for grower-approved RTR windows.

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
1. If working on RTR calibration, unblock issue `#3` with real grower-approved windows before opening its implementation branch.
2. Otherwise, start the next non-trivial task from a fresh issue-based branch off clean `main`.
