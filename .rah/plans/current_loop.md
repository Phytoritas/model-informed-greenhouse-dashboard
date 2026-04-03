# Current Loop

## Earliest Pending Gate
- Issue `#6` delivery sync (commit/push/PR/CI)

## Exact Restart Step
1. Review the issue `#6` diff on branch `data/6-add-live-produce-price-panel-from-kamis-api`, then commit and push the KAMIS produce price panel slice and open a PR tied to issue `#6`.
2. Keep issue `#6` in `Running` until the PR is open, then move it to `Validating` after GitHub Actions passes and attach the new browser-smoke artifact if reviewer context is needed.
3. After the issue `#6` delivery loop is closed, return to issue `#3`, which remains blocked until grower-approved good-production periods are available for RTR recalibration.
