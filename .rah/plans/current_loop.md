# Current Loop

## Earliest Pending Gate
- RTR good-production windows (waiting for grower-approved periods)

## Exact Restart Step
1. Continue on issue `#3` and branch `feat/3-replace-concept-demo-rtr-windows-with-grower-approved-periods`; issues `#8`, `#10`, and `#12` are now complete and merged, so the remaining active gap is again the blocked RTR calibration-input upgrade.
2. When grower-approved good-production periods are available, replace the concept-demo windows in `configs/rtr_good_windows.yaml`, make sure the grower file uses valid ISO dates and explicit booleans, and rerun `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json`.
3. Re-run a representative RTR browser smoke after the regenerated profile payload lands, then open the follow-up PR; rerun a live AI consult/chat smoke only if the prompt or dashboard context contract changes during that slice.
