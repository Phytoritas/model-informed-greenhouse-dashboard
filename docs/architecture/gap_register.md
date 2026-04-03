# Gap Register

| Gap | Current state | Target state | Phase | Validation signal |
|---|---|---|---|---|
| Live produce price panel delivery | PR `#7` is open for issue `#6`, the branch is pushed, and both push + pull_request CI runs are green | Review and merge the KAMIS produce price panel loop | Phase 7 | GitHub Actions checks on PR `#7`, reviewer-visible dashboard panel, and the saved browser-smoke artifacts |
| RTR good-production windows | `configs/rtr_good_windows.yaml` contains concept-demo windows derived from sample histories | Grower-approved windows replace the demo segments and `configs/rtr_profiles.json` is regenerated from the approved inputs | Phase 8 | `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json` plus a representative RTR browser smoke |
