# Current Loop

## Earliest Pending Gate
- Issue `#10` delivery push/PR/CI

## Exact Restart Step
1. Commit the issue `#10` branch and push `fix/10-fix-kamis-trend-overlay-fallback-and-labeling`.
2. Open a PR that closes issue `#10`, then watch the GitHub Actions push + pull_request runs while the item moves to `Validating`.
3. If reviewer context is needed, point to the local validation ladder (`npm --prefix frontend run lint`, `poetry run ruff check .`, `poetry run pytest`, `npm --prefix frontend run build`) plus the direct live KAMIS fetch smoke that returned four featured series, zero unavailable overlays, and the expected `2026-03-21` to `2026-04-17` window.
4. After issue `#10` is delivered, return to issue `#3`, which remains blocked until grower-approved good-production periods are available for RTR recalibration.
