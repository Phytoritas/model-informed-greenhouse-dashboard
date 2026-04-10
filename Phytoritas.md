# Model-Informed Greenhouse Dashboard Blueprint

## Repository
- Repo root: `C:\Users\yhmoo\OneDrive\Phytoritas\projects\model-informed-greenhouse-dashboard`
- GitHub repo: `https://github.com/Phytoritas/model-informed-greenhouse-dashboard`
- Project name: `model-informed-greenhouse-dashboard`
- Package name: `model_informed_greenhouse_dashboard`
- Current baseline branch: `main`
- Current merged UI baseline: issues `#65`, `#67`, `#69`, `#74`, `#80`, `#82`, `#84`
- Current control-plane sync baseline: issue `#86`

## Active Baseline
`main` now carries the compact PhytoSync operating shell, the overlap/clipping follow-ups, and the recovered control realtime baseline.

- visible primary navigation: `/overview`, `/control`, `/crop-work`, `/resources`, `/alerts`
- hidden compatibility routes: `/assistant`, `/settings`
- compatibility redirects: `/rtr -> /control#control-strategy`, `/ask#... -> /assistant#...`
- bounded shell rhythm: `248px` sidebar, `80px` header, `1320px` main canvas
- preserved product/runtime seams: `/api/models/*`, `/api/advisor/*`, `/api/rtr/*`, weather, market, crop switching, and area-unit projections

## Current Maintenance Lane
The current maintenance work is no longer a product IA rewrite. It is baseline hygiene.

- keep blueprint pointers aligned with the merged `main` baseline
- keep `.rah` control-plane truth aligned with the same merged baseline
- keep the blueprint mirror, doctor snapshot, and backlog pointers aligned with the same merged baseline
- rehydrate missing local-only `.rah` runtime seed files when harness doctor/status/resume need them
- keep issue `#3` explicitly blocked until real grower-approved RTR windows are supplied; do not synthesize calibration windows from demo history
- start any new non-trivial product or architecture change from a fresh GitHub issue/branch instead of reopening merged UI slices

## Source Of Truth
1. nearest `AGENTS.md`
2. this `Phytoritas.md`
3. `.rah/state/status.json`
4. `.rah/state/gates.json`
5. `.rah/memory/wakeup.md`
6. `.rah/plans/current_loop.md`
7. `docs/architecture/Phytoritas.md`
8. repo code, tests, and GitHub issue state

## Non-Negotiables
- Do not break `/api/models/*`, `/api/advisor/*`, `/api/rtr/*`, weather, market, or area-unit contracts while doing shell or copy cleanup.
- Do not reopen the routed-shell IA or compact-control work without a fresh bounded issue.
- Do not invent grower-approved calibration windows from heuristic/demo periods; issue `#3` stays blocked until operator-approved windows exist.
- Do not treat local runtime seed JSON as versioned durable source of truth; tracked control-plane truth stays in `status.json`, `gates.json`, `current_loop.md`, and `wakeup.md`.
- Do not let Memento memory override repo facts or the active `AGENTS.md`.
- Do not skip the repo validation ladder before claiming a bounded slice is complete.

## Current Architecture Target
### Product Shell Baseline
- `frontend/src/App.tsx`: route registration and shared state plumbing, not a giant page assembler
- `frontend/src/app/route-meta.ts`: current grower-facing shell metadata
- `frontend/src/routes/phytosyncSections.ts`: canonical section metadata and compatibility hashes
- `frontend/src/layout/AppShell.tsx`: bounded shell canvas and sidebar/header contract
- `frontend/src/pages/*`: dedicated routed page composition instead of the old stack shell

### Harness Baseline
- tracked control-plane truth:
  - `.rah/state/status.json`
  - `.rah/state/gates.json`
  - `.rah/plans/current_loop.md`
  - `.rah/memory/wakeup.md`
  - `.rah/logs/activity_log.md`
- local runtime seed/state files that may need rehydration on a clean checkout:
  - `.rah/state/memento_status.json`
  - `.rah/memory/memento_context.json`
  - `.rah/memory/memento_recall.json`
  - `.rah/memory/memento_feedback.json`
  - `.rah/memory/memento_reflect_draft.json`
  - `.rah/memory/case_map.json`
- harness entrypoint when the repo itself has no local wrapper:
  - `python C:\Users\yhmoo\.codex\skills\recursive-architecture-refactoring-auto\automation\rah.py doctor <repo-root>`
  - `python C:\Users\yhmoo\.codex\skills\recursive-architecture-refactoring-auto\automation\rah.py status <repo-root>`
  - `python C:\Users\yhmoo\.codex\skills\recursive-architecture-refactoring-auto\automation\rah.py resume <repo-root>`

## Decision Gates
### Gate A. Product contract preservation
- keep the merged issue `#65/#67/#69/#74/#80/#82/#84` shell behavior and runtime contracts stable

### Gate B. Harness health
- `automation/rah.py doctor` must not hard-fail on a healthy local checkout
- warn-only findings such as optional hook/deployment gaps are acceptable

### Gate C. Blueprint pointer alignment
- `Phytoritas.md`, `docs/architecture/Phytoritas.md`, `.rah/state/status.json`, `.rah/state/gates.json`, `.rah/memory/wakeup.md`, and `.rah/plans/current_loop.md` must describe the same baseline

### Gate D. Validation lock
- `npm --prefix frontend run lint`
- `npm --prefix frontend run test -- --pool=threads`
- `npm --prefix frontend run build`
- `poetry run ruff check .`
- `poetry run pytest`

## Immediate Next Action
- If grower-approved tomato/cucumber production windows become available, resume issue `#3` on its own bounded branch and recalibrate `configs/rtr_profiles.json`.
- Otherwise treat `main` as the clean post-issue84 baseline, and open a fresh issue/branch for any unrelated follow-up work.
- If harness doctor/status/resume drift reappears, rehydrate the local runtime seed files first, then rerun `automation/rah.py doctor|status|resume` before making broader decisions.
