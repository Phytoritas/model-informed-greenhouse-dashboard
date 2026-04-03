# ADR-000: Adopt Recursive Architecture Workflow For Source-Project Intake

## Status
Accepted

## Context
The target repository was bootstrapped correctly but does not yet contain the runtime dashboard implementation. The source project `dashboard-eng_1.1` contains the needed backend, legacy models, and frontend, but it also carries path assumptions, mixed validation surfaces, and layout choices that do not fit the target repository cleanly.

## Decision
Use a recursive architecture workflow with harness state so the migration proceeds in explicit gates:

1. repair issue/branch linkage first
2. bootstrap `docs/architecture/` and `.rah/`
3. inventory the source and target delta
4. migrate the backend runtime into package-owned code
5. add bounded smoke coverage
6. stage frontend migration only after the backend slice is stable enough to validate

## Consequences
- Architecture reasoning and runtime state become restartable without chat history alone.
- Legacy models may remain mechanically similar at first, but only behind adapter boundaries.
- The repository can evolve toward a full dashboard workspace without losing blueprint-first discipline.
