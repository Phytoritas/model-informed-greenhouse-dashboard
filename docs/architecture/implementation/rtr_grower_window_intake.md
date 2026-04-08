# RTR Grower Window Intake

## Purpose
Provide an explicit intake contract for replacing the current heuristic/demo RTR calibration windows with grower-approved good-production periods under issue `#3`.

## Why This Exists
- `configs/rtr_good_windows.yaml` currently contains concept-demo windows derived from environment-only history.
- The calibration pipeline is ready, but the repository still lacks approved production windows with operator sign-off.
- The next safe slice is not to invent new windows, but to collect and record the real approved periods in a repeatable way.

## Required Inputs Per Window
For each tomato or cucumber window, collect:

- crop
- greenhouse or house identifier if available
- `startDate`
- `endDate`
- short label
- approval source
  - grower
  - manager
  - consultant
  - internal review
- reason for approval
  - stable yield
  - acceptable fruit quality
  - acceptable labor load
  - acceptable climate stability
- evidence notes
  - harvest trend
  - quality observation
  - climate note
  - work-event note
- explicit `enabled: true|false`

## Minimum Acceptance Rule
Do not replace a demo window unless all of the following are true:

- the window dates are explicit and inclusive
- the crop is explicit
- the approver or approval source is recorded
- the reason for calling it a good-production period is written down
- the window does not rely only on fit quality or radiation/temperature smoothness

## YAML Update Contract
When approved windows arrive, update only:
- `configs/rtr_good_windows.yaml`

Preferred per-window shape:

```yaml
crops:
  Tomato:
    - label: tomato-grower-approved-2024-08-window-a
      startDate: "2024-08-06"
      endDate: "2024-08-26"
      enabled: true
      notes: >
        Grower-approved good-production period. Reason: stable harvest and acceptable
        fruit quality with no major stress events. Approval source: greenhouse manager.
```

## Recalibration Runbook
After updating `configs/rtr_good_windows.yaml`:

```bash
poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json
```

Then run targeted checks:

```bash
poetry run pytest tests/test_rtr_profiles.py
poetry run pytest tests/test_smoke.py -k rtr
```

If those pass, continue with the broader ladder only after inspecting the profile delta.

## Profile Delta Review Checklist
Before opening a PR, inspect:

- `baseTempC` change by crop
- `slopeCPerMjM2` change by crop
- `selectionSource` switches to `curated-windows`
- `windowCount` matches the approved windows that were actually enabled
- no crop unexpectedly falls back to `insufficient-data`

## Explicit Non-Goals
- Do not infer grower approval from model fit quality alone
- Do not expand the optimizer logic in this issue
- Do not change the current optimizer weights or risk bounds in the same slice unless the recalibrated baseline shows a clear follow-up need
