# Current Loop

## Earliest Pending Gate
- none

## Exact Restart Step
1. Commit and push the current branch so `.github/workflows/ci.yml` can run remotely; issue `#1` is already set to `Validating` and has a fresh progress comment.
2. Once remote CI is green, create or refresh the PR with the repo helper script and keep the linked project item aligned with `Validating`.
3. After the GitHub workflow settles, replace the current heuristic demo windows in `configs/rtr_good_windows.yaml` with grower-approved good-production periods and rerun `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json`.
