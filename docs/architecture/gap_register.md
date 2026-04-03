# Gap Register

| Gap | Current state | Target state | Phase | Validation signal |
|---|---|---|---|---|
| Live produce price panel delivery | Issue `#6` branch has a KAMIS-backed backend endpoint, a new dashboard panel, local validation green, and a browser smoke artifact | Commit/push the branch, open a PR, and get GitHub Actions plus reviewer validation green | Phase 7 | `npm --prefix frontend run lint`, `poetry run ruff check .`, `poetry run pytest`, `npm --prefix frontend run build`, browser smoke on `127.0.0.1:8000/4173`, then PR CI |
| RTR good-production windows | `configs/rtr_good_windows.yaml` contains concept-demo windows derived from sample histories | Grower-approved windows replace the demo segments and `configs/rtr_profiles.json` is regenerated from the approved inputs | Phase 8 | `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json` plus a representative RTR browser smoke |
