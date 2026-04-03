# Current Loop

## Earliest Pending Gate
- RTR good-production windows (waiting for grower-approved periods)

## Exact Restart Step
1. Continue on issue `#3` and branch `feat/3-replace-concept-demo-rtr-windows-with-grower-approved-periods`; issue `#1` and PR `#2` are already complete.
2. When grower-approved good-production periods are available, replace the concept-demo windows in `configs/rtr_good_windows.yaml` and rerun `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json`.
3. Re-run a representative RTR browser smoke after the regenerated profile payload lands, and rerun a live AI consult/chat smoke only if the prompt or dashboard context contract changes during that follow-up slice.
