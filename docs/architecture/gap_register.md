# Gap Register

| Gap | Current state | Target state | Phase | Validation signal |
|---|---|---|---|---|
| RTR good-production windows | `configs/rtr_good_windows.yaml` still contains concept-demo windows derived from sample histories; issues `#8` / `#10` / `#12` are merged and the synced issue `#3` branch already carries the KAMIS live panel, the 14-day trend overlay, the fallback hardening, and the dashboard layout rebalance | Grower-approved windows replace the demo segments and `configs/rtr_profiles.json` is regenerated from the approved inputs | Phase 8 | `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json` plus a representative RTR browser smoke |
