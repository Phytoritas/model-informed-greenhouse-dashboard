# Current Loop

## Earliest Pending Gate
- RTR good-production windows (waiting for grower-approved periods)

## Exact Restart Step
1. Keep PR `#2` tied to issue `#1`; the branch is pushed and both GitHub Actions CI runs are green, so the next human gate is review and merge while the project item stays in `Validating`.
2. When grower-approved good-production periods are available, replace the concept-demo windows in `configs/rtr_good_windows.yaml` and rerun `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json`.
3. If the AI prompt or dashboard context contract changes again, rerun a representative live consult/chat smoke with the repo-local `OPENAI_API_KEY` before treating the new wording as validated.
