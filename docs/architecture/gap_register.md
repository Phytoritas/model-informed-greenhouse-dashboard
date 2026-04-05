# Gap Register

| Gap | Current state | Target state | Phase | Validation signal |
|---|---|---|---|---|
| Dashboard layout sizing delivery | Issue `#12` is locally implemented on branch `fix/12-rebalance-dashboard-panel-sizing-and-layout`; lint, build, ruff, pytest, and desktop/mobile browser smokes already pass | Commit/push the branch, open the PR, and clear remote CI for the dashboard shell widening plus responsive weather/produce/RTR panel rebalance | Phase 7 | GitHub Actions checks on the future PR plus the saved `issue12-layout-desktop.png` / `issue12-layout-mobile.png` browser-smoke artifacts |
| RTR good-production windows | `configs/rtr_good_windows.yaml` contains concept-demo windows derived from sample histories | Grower-approved windows replace the demo segments and `configs/rtr_profiles.json` is regenerated from the approved inputs | Phase 8 | `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json` plus a representative RTR browser smoke |
