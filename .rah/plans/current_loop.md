# Current Loop

## Earliest Pending Gate
- Issue `#16` delivery push/PR/CI

## Exact Restart Step
1. Commit the issue `#16` branch and push `data/16-show-wholesale-produce-prices-alongside-retail-market-panel`.
2. Open a PR that closes issue `#16`, then watch the GitHub Actions push + pull_request runs while the item moves to `Validating`.
3. If reviewer context is needed, point to the local validation ladder (`npm --prefix frontend run lint`, `poetry run ruff check .`, `poetry run pytest`, `npm --prefix frontend run build`), the direct live KAMIS fetch smoke showing four retail plus four wholesale featured items, and the browser-smoke screenshots under `artifacts/browser-smoke/issue16-wholesale-market-panel.png` and `artifacts/browser-smoke/issue16-wholesale-panel-mocked.png`.
4. After issue `#16` is delivered, return to issue `#3`, which remains blocked until grower-approved good-production periods are available for RTR recalibration.
