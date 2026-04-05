# Current Loop

## Earliest Pending Gate
- Issue `#12` delivery push/PR/CI

## Exact Restart Step
1. Commit the issue `#12` branch and push `fix/12-rebalance-dashboard-panel-sizing-and-layout`.
2. Open a PR that closes issue `#12`, then watch the GitHub Actions push + pull_request runs while the item moves to `Validating`.
3. If reviewer context is needed, point to the local validation ladder (`npm --prefix frontend run lint`, `poetry run ruff check .`, `poetry run pytest`, `npm --prefix frontend run build`) plus the browser-smoke screenshots under `artifacts/browser-smoke/issue12-layout-desktop.png` and `artifacts/browser-smoke/issue12-layout-mobile.png`, which confirm the weather, produce-price, and RTR panels now scale against their chart/card content on desktop and mobile.
4. After issue `#12` is delivered, return to issue `#3`, which remains blocked until grower-approved good-production periods are available for RTR recalibration.
