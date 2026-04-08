# Architecture Blueprint Mirror

Source of truth: [`/Phytoritas.md`](../../Phytoritas.md)

## Active lane
- Issue: `#27`
- Branch: `feat/27-overhaul-rtr-around-internal-model-optimizer-and-area-aware-projections`
- Mode: `internal-model-only RTR optimizer`

## Preserved baseline
- Keep the merged issue `#19` model-first runtime as the RTR donor computation stack
- Keep the current dashboard runtime, weather/RTR/market panels, crop switching, and AI consult/chat flows stable
- Keep `/api/rtr/profiles` and `configs/rtr_profiles.json` backward compatible

## Current gate picture
- Harness setup: passed
- Issue/branch linkage for issue `#27`: passed
- Backend internal-model RTR services: passed
- Frontend optimizer surface plus area projection: passed
- Full local validation ladder: passed

## Target packages
- `backend/app/services/rtr/`
- `frontend/src/context/AreaUnitContext.tsx`
- `frontend/src/components/AreaUnitPanel.tsx`
- `frontend/src/hooks/useRtrOptimizer.ts`
- `frontend/src/components/RTROptimizerPanel.tsx`

## Target runtime contracts
- `GET /api/rtr/profiles`
- `GET /api/rtr/state`
- `POST /api/rtr/optimize`
- `POST /api/rtr/scenario`
- `POST /api/rtr/sensitivity`
- `POST /api/rtr/area-settings`

## Next restart point
- Commit and push the landed issue `#27` slice
- Open the PR and move into remote Backend/Frontend validation
- Use the next loop for calibration follow-up: grower-approved windows, optimizer weight tuning, and house-specific bounds
