# Architecture Blueprint Mirror

Source of truth: [`/Phytoritas.md`](../../Phytoritas.md)

## Active lane
- Issue: `#19`
- Branch: `feat/19-implement-model-first-smartgrow-advisor-with-crop-physiology-gas-exchange-and-sensitivity-engines`
- Mode: `model-first, RAG-explained`

## Preserved baseline
- Keep the issue `#18` knowledge/RAG/advisory surfaces as the compatibility baseline
- Keep the current dashboard runtime, weather/RTR/market panels, crop switching, and AI consult/chat flows stable
- Keep legacy tomato/cucumber model code as donor logic for the new service layer

## Current gate picture
- Harness setup: passed
- Issue/branch linkage for the new requirement: passed
- Blueprint and system brief realignment: passed
- Implementation gate for issue `#19`: blocked pending the phase-1 persistence-adapter and migration-seam freeze

## Target packages
- `backend/app/services/crop_models/`
- `backend/app/services/model_runtime/`
- `backend/app/services/advisory/`
- `backend/app/services/rag/`

## Target runtime contracts
- `POST /api/models/snapshot`
- `POST /api/models/replay`
- `POST /api/models/scenario`
- `POST /api/models/sensitivity`
- `POST /api/advisor/physiology`
- `POST /api/advisor/environment`
- `POST /api/advisor/work-tradeoff`
- `POST /api/advisor/harvest`
- `POST /api/advisor/chat`

## Next restart point
- Freeze the phase-1 persistence-adapter choice and migration seam in code
- Then land the bounded model-state and work-event foundation before scenario/sensitivity or UI expansion
