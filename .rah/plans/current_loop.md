# Current Loop

## Active State
- Active implementation branch: `fix/100-fix-sensor-freshness-semantics-and-websocket-delay`.
- Active issue: `#100` (`[Bug] Fix sensor freshness semantics and websocket delay`).
- Active pull request: `#101` (`fix: recover stalled telemetry streams`).
- Current bounded scope: keep the issue100 lane in `Validating`, with the pushed backend/frontend/runtime-recovery diff waiting only for review and merge.

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
- GitHub Actions `CI` succeeded for both the `push` and `pull_request` runs on commit `ae600ed`.
- Local smoke confirmed that `/api/status` returns immediately after single-backend restart, `last_error` clears, and the overview page reconnects the cucumber WebSocket after an offline transition.

## Exact Next Step
1. Review and merge PR `#101` once the bounded issue100 runtime-recovery diff is accepted.
2. After merge, fast-forward local `main`, confirm the merged baseline stays green, and open the small docs sync issue that realigns tracked `.rah` state on main.
3. Keep blocked issue `#3` out of this lane; resume it only from a separate branch when grower-approved RTR windows exist.
