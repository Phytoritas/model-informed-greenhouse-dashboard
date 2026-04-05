# Current Loop

## Earliest Pending Gate
- Issue `#8` delivery push/PR/CI

## Exact Restart Step
1. Commit the issue `#8` branch and push `data/8-add-2-week-produce-price-trends-and-seasonal-normals`.
2. Open a PR that closes issue `#8`, then watch the GitHub Actions push + pull_request runs while the item moves to `Validating`.
3. If reviewer context is needed, point to the local validation ladder (`npm --prefix frontend run lint`, `npm --prefix frontend run build`, `poetry run ruff check .`, `poetry run pytest`) plus the direct live KAMIS fetch smoke that returned four featured series with 14-day history and forward seasonal normals.
4. After issue `#8` is delivered, return to issue `#3`, which remains blocked until grower-approved good-production periods are available for RTR recalibration.
