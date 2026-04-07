# Current Loop

## Earliest Pending Gate
- No code-side pending gate remains inside the current issue `#19` lane
- Current bounded blocker is human workflow only: PR `#20` review and merge

## Landed In This Loop
- Knowledge/advisor CI stabilization: synthetic workbook-backed advisory and knowledge-query tests hardened for CI instead of local-only workbook assumptions
- Knowledge status sanitization: asset `relative_path` now uses the same `_public_path()` guard as top-level catalog fields
- Market-summary refresh hardening: dashboard auto-analysis now refreshes when live produce-price snapshots arrive late, not only when telemetry timestamps advance
- Validated: `poetry run ruff check .`, `poetry run pytest`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`, plus green GitHub Actions push and pull_request runs for PR `#20`

## Exact Restart Step
1. Continue on issue `#19` and branch `feat/19-implement-model-first-smartgrow-advisor-with-crop-physiology-gas-exchange-and-sensitivity-engines`.
2. Treat the issue `#18` knowledge/RAG/nutrient/pesticide/advisor surfaces as the preserved compatibility baseline.
3. Treat all previously landed foundations, the UI/UX layout fix, the knowledge/advisor CI hardening, and the market-summary refresh fix as fixed for now.
4. If PR `#20` is approved, merge first before starting more code on issue `#19`.
5. If issue `#19` continues without merge, choose a new bounded loop explicitly: work-event-driven compare, optimizer depth, additional UI/UX polish (second-row panel alignment, mobile tweaks, advisor tab scrollability), or broader model-first feature expansion.
6. Keep every runtime consumer additive and snapshot-aware.
7. Preserve issue `#18` and issue `#3` as separate compatibility and blocked follow-up lanes.
