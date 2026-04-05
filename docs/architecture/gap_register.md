# Gap Register

| Gap | Current state | Target state | Phase | Validation signal |
|---|---|---|---|---|
| KAMIS wholesale market delivery | Issue `#16` is locally implemented on branch `data/16-show-wholesale-produce-prices-alongside-retail-market-panel`; lint, build, ruff, pytest, direct live KAMIS fetch, and browser smokes already pass | Commit/push the branch, open the PR, and clear remote CI for the retail+wholesale market snapshot expansion and frontend rollout-skew fallback | Phase 7 | GitHub Actions checks on the future PR plus the saved `issue16-wholesale-market-panel.png` / `issue16-wholesale-panel-mocked.png` browser-smoke artifacts |
| RTR good-production windows | `configs/rtr_good_windows.yaml` contains concept-demo windows derived from sample histories | Grower-approved windows replace the demo segments and `configs/rtr_profiles.json` is regenerated from the approved inputs | Phase 8 | `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json` plus a representative RTR browser smoke |
