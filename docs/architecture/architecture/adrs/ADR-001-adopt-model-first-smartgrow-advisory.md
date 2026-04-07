# ADR-001: Adopt Model-First SmartGrow Advisory

## Status
Accepted for issue `#19`.

## Context
The repository already landed a SmartGrow baseline under issue `#18`:
- knowledge catalog and knowledge database surfaces
- workbook-backed pesticide and nutrient advisory seams
- routed retrieval and bounded advisor context builders
- prompt-level advisor tab shells and a thin advisor orchestration layer

The new April 7, 2026 directive changes the center of gravity.
The mainline is no longer knowledge-first expansion.
The mainline is model-actuated advisory with crop physiology state, coupled gas exchange, bounded scenarios, local sensitivity, constraints, and event-sourced work metadata.

Repo policy also requires a new issue for a new requirement.

## Decision
1. Open issue `#19` and treat it as the active mainline for the new SmartGrow requirement.
2. Preserve issue `#18` code and contracts as the compatibility baseline.
3. Make crop-model state, bounded scenario outputs, sensitivity outputs, and constraint checks the primary recommendation drivers.
4. Keep retrieval and knowledge context as explanation, guardrail, and provenance support only.
5. Wrap legacy tomato/cucumber model code behind new `crop_models/` service interfaces instead of exposing legacy classes directly to the new APIs.
6. Land the new work in bounded phases: phase-1 state/event foundation, phase-2 gas exchange/runtime core, phase-3 advisor migration, then later optimization and infrastructure promotion.
7. Keep UI provenance internal and never expose raw chunk/document/rule/calculator identifiers directly to end users.

## Consequences
### Positive
- The architecture now matches the user's requested model-first SmartGrow direction.
- Existing issue `#18` code remains usable and testable while the new runtime is built beside it.
- Legacy model code can be reused pragmatically instead of being rewritten blindly.

### Negative
- The current harness truth state had to be reset, and implementation is blocked again until the phase-1 migration seam is frozen.
- Some existing advisor and retrieval work is demoted from mainline to baseline/supporting infrastructure.

### Follow-up
- Use `module-001-model-first-smartgrow-runtime.md` as the bounded phase-1 implementation boundary.
- Keep `.rah/state/status.json` and `.rah/state/gates.json` honest about the blocked implementation gate until the phase-1 persistence adapter and migration seam are frozen in code.
