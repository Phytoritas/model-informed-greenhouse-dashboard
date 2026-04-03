# Implementation Gate Checklist

Implementation is allowed only when the following items are explicit:

- [x] Active issue and issue-based branch exist
- [x] Root blueprint reflects the source-project migration loop
- [x] Workspace audit records current repo state and source-project delta
- [x] System brief defines the target module boundaries
- [x] Backend package layout is fixed enough to migrate source runtime safely
- [x] Config contract location and loading path are explicit in code
- [x] Smoke test target for the first migrated slice is chosen
- [x] Frontend is either intentionally deferred or explicitly in scope with a validation plan

## Pass Rule
The first implementation gate passes when the backend runtime migration can proceed without further directory-structure ambiguity, and when the first smoke validation target is known.

## Current Assessment
- The implementation gate remains passed: the backend/runtime migration, frontend migration, and representative local validation ladder are all in place.
- The canonical frontend path is still the source `frontend/` Vite app, now migrated into the target repo and revalidated with `npm --prefix frontend run build`, `npm --prefix frontend run lint`, `poetry run pytest`, and `poetry run ruff check .`.
- The next delivery loop is no longer architecture intake; it is commit/push, remote CI / PR synchronization, and later replacement of the concept-demo RTR windows with grower-approved calibration periods.
