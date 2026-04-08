# Architecture Blueprint Mirror

Source of truth: [`/Phytoritas.md`](../../Phytoritas.md)

## Active lane
- Issue: `none`
- Branch: `main`
- Mode: `merged issue #27 RTR optimizer baseline`

## Preserved baseline
- Keep the merged issue `#19` model-first runtime as the RTR donor computation stack
- Keep the current dashboard runtime, weather/RTR/market panels, crop switching, and AI consult/chat flows stable
- Keep `/api/rtr/profiles` and `configs/rtr_profiles.json` backward compatible

## Current gate picture
- Harness setup: passed
- Issue/branch linkage for issue `#27`: passed and merged
- Backend internal-model RTR services: passed
- Frontend optimizer surface plus area projection: passed
- Full local validation ladder: passed
- PR `#28` validation and merge: passed

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
- Open a fresh issue if post-merge RTR work should continue
- Prefer a calibration-focused next loop: grower-approved windows, optimizer weight tuning, and house-specific bounds
- Otherwise treat `main` as the new clean restart baseline
