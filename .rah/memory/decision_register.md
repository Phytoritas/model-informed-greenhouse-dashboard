# Decision Register

- 2026-04-02: Treat the source project `dashboard-eng_1.1` as an intake source, not as a directory layout to mirror blindly.
- 2026-04-02: Migrate the backend runtime before the frontend so the package and config boundaries can stabilize under the current validation ladder.
- 2026-04-02: Use the source `frontend/` Vite app as the canonical frontend migration path for this repository.
- 2026-04-02: Keep the source `Tomato_Env.CSV` and `Cucumber_Env.CSV` as local sample fixtures in `data/` so the migrated frontend can auto-start simulations without extra setup.
- 2026-04-02: Store operational settings and crop-config mutations per crop in backend state instead of mutating a single shared dashboard config.
- 2026-04-02: Treat `localhost` and `127.0.0.1` as equivalent local browser hosts in frontend defaults and backend CORS so the dev dashboard smoke does not depend on one exact hostname.
- 2026-04-02: Keep the dashboard shell eager, but move chart-heavy and report/chat-heavy UI modules behind lazy boundaries with explicit vendor chunk grouping so production chunks stay below the Vite warning threshold without breaking the built preview smoke.
- 2026-04-03: Switch the backend AI helper from Gemini to the OpenAI Responses API and load `OPENAI_API_KEY` from the repo-root `.env` so live AI responses are enabled through the backend environment.
