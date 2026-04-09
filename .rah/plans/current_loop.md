# Current Loop

## Active State
- Issue `#57` is active on branch `fix/57-reduce-frontend-entry-chunk-size-with-route-level-code-splitting`.
- Root repository is no longer idle: a bounded frontend performance follow-up is in flight over clean `main`.
- The current slice only touches `frontend/vite.config.ts` and keeps all landed runtime/API/UI surfaces intact.
- Issue `#3` remains intentionally `Blocked` as the optional real grower-window calibration follow-up.

## Latest In-Flight Slice
- Issue `#57` targets the remaining frontend Vite chunk-size warning.
- `frontend/vite.config.ts` now splits `react`, `react-dom`, `scheduler`, `react-router*`, `@remix-run/*`, and `lucide-react` into dedicated vendor chunks while preserving the existing `charts-vendor` and `markdown-vendor` boundaries.
- Local production build result after the change:
  - previous `index` chunk: `513.46 kB`
  - current `index` chunk: `284.08 kB`
  - Vite `>500 kB` warning: cleared

## Latest Validation
- Local ladder for issue `#57` is green:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --pool=threads`
  - `npm --prefix frontend run build`
- No remote PR/CI lane exists yet for issue `#57`; the next exact step is commit/push/PR.

## Exact Next Step
1. Commit the bounded `vite.config.ts` change on the issue `#57` branch.
2. Push the branch and open a PR that closes `#57`.
3. Move the project item to `Validating` and wait for GitHub Actions Backend/Frontend validation.
