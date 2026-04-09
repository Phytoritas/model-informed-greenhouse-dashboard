# Current Loop

## Active State
- Active issue: `#47`
- Active branch: `feat/47-close-remaining-phytosync-shadcn-redesign-prompt-gaps`
- PR `#48` is the active validating lane for the remaining `codex_phytosync_shadcn_redesign_prompt.md` gap-closure work.
- Issue `#3` still remains intentionally `Blocked`, but only as the optional real grower-window calibration follow-up behind the landed RTR UI/runtime baseline.

## Latest Delivered Baseline
- `main` already includes the merged issue `#41` actuator-first RTR control seam:
  - first-class heating, cooling, ventilation, thermal-screen, circulation-fan, and CO2 control candidates
  - `actuator_bridge -> post_control_state -> crop_bridge -> objective_terms` evaluation
  - canonical `m²` metrics plus actual-area projections
- `main` also includes the merged issue `#45` PhytoSync UI redesign baseline:
  - premium command-center shell styling over the existing greenhouse dashboard runtime
  - layout, navigation, advisor, weather, market, and decision-surface polish
  - route-safe frontend stabilization, Korean-first visual hierarchy, and improved live-surface presentation

## Active Delivery Slice
- Issue `#47` closes the remaining prompt-alignment gaps on top of that merged UI baseline:
  - route-driven `PhytoSync` workspace shell modules under `frontend/src/routes/`
  - shared design token, layout, Korean copy, and style-layer files under `frontend/src/lib/design/` and `frontend/src/styles/`
  - a dedicated ask/search workspace under `frontend/src/components/phyto/`
  - Korean visible-copy cleanup that replaces stale `Review state`, `Evidence level`, and similar prompt-forbidden labels
  - accessibility hardening for section tabs and navigation, plus Vitest coverage for the new route-shell surfaces

## Latest Validation
- The active issue `#47` lane is locally green with:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --pool=threads`
  - `npm --prefix frontend run build`
- The issue `#47` branch is committed as `f07dad5` and pushed to origin.
- PR `#48` is open and GitHub Actions `Backend Validation` plus `Frontend Validation` are in progress on both the push and pull_request runs.

## Exact Next Step
1. Watch PR `#48` GitHub Actions on the latest pushed issue `#47` branch head.
2. If any remote check fails, fix only that failing surface on the same issue `#47` branch and rerun the local frontend ladder before pushing again.
3. If PR `#48` goes green, merge it, fast-forward `main`, and reset `.rah` back to a merged no-active-loop baseline while keeping issue `#3` blocked as the optional calibration follow-up.
