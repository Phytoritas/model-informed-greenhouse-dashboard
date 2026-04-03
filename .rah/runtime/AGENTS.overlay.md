# Harness Overlay

This repository is running the recursive-architecture-refactoring harness in hybrid mode.

Overlay reminders:

- Keep the repo-local `AGENTS.md` workflow as the operating source of truth.
- Treat issue/branch linkage as a hard gate before non-trivial writes.
- Keep the root `Phytoritas.md` as the canonical blueprint.
- Use `docs/architecture/` for durable design reasoning and `.rah/` for restartable runtime state.
- Do not mark implementation ready until the backend migration slice and smoke validation both pass.
