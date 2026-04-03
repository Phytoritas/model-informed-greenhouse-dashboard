# Gap Register

| Gap | Current state | Target state | Phase | Validation signal |
|---|---|---|---|---|
| RTR good-production windows | `configs/rtr_good_windows.yaml` still contains concept-demo windows derived from sample histories, and the follow-up is now tracked on issue `#3` / `feat/3-replace-concept-demo-rtr-windows-with-grower-approved-periods` | Grower-approved windows replace the demo segments and `configs/rtr_profiles.json` is regenerated from the approved inputs | Phase 6 | `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json` plus a representative RTR browser smoke |
