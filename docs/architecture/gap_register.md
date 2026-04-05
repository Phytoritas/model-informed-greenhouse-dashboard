# Gap Register

| Gap | Current state | Target state | Phase | Validation signal |
|---|---|---|---|---|
| Produce price trend hardening delivery | Issue `#10` is locally implemented on branch `fix/10-fix-kamis-trend-overlay-fallback-and-labeling`; lint, build, ruff, pytest, and a direct live KAMIS fetch smoke already pass | Commit/push the branch, open the PR, and clear remote CI for the fallback-preserving payload plus clarified chart labeling/sample-coverage contract | Phase 7 | GitHub Actions checks on the future PR, the updated dashboard chart copy/tooltips, and the direct live KAMIS fetch smoke |
| RTR good-production windows | `configs/rtr_good_windows.yaml` contains concept-demo windows derived from sample histories | Grower-approved windows replace the demo segments and `configs/rtr_profiles.json` is regenerated from the approved inputs | Phase 8 | `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json` plus a representative RTR browser smoke |
