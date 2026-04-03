# Gap Register

| Gap | Current state | Target state | Phase | Validation signal |
|---|---|---|---|---|
| Remote CI / PR sync | Local validation ladder passes, but the branch is still dirty and the current `.github/workflows/ci.yml` changes have not run on GitHub yet | Current branch is committed, pushed, and backed by a green GitHub Actions run plus an open or refreshed PR for issue `#1` | Phase 5 | GitHub Actions checks pass on the pushed branch and the PR is linked to issue `#1` |
| RTR good-production windows | `configs/rtr_good_windows.yaml` contains concept-demo windows derived from sample histories | Grower-approved windows replace the demo segments and `configs/rtr_profiles.json` is regenerated from the approved inputs | Phase 6 | `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json` plus a representative RTR browser smoke |
| Live AI credential smoke | Unit coverage and historical live validation exist, but the current local recheck only confirmed graceful fallback and prompt-contract tests | A fresh consult/chat smoke is captured against the repo-local `OPENAI_API_KEY` before relying on live AI wording for the next delivery slice | Phase 6 | Direct consult/chat response log or equivalent smoke artifact showing live weather and RTR context usage |
