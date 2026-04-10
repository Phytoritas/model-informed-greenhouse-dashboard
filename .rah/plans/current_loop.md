# Current Loop

## Active State
- Issue `#65` is active on branch `hyp/65-simplify-phytosync-ui-into-a-compact-coral-tile-shell`.
- The issue61 routed shell on `main` is the preserved baseline, not the end state.
- The active target is a five-page compact coral tile operating shell with hidden assistant/settings routes, `/rtr` absorbed into control, and a bounded 1320px content canvas.

## Baseline To Preserve
- `main` already includes the merged issue `#61` routed-shell extraction and the post-merge `.rah` sync from issue `#63`.
- The baseline still exposes eight primary routes in `route-meta.ts`, a separate `/rtr` peer page, inline `/assistant`, and page wrappers with mixed width caps and stacked vertical cards.
- Those baseline facts should be treated as the donor structure for issue `#65`, not as a target to preserve visually.

## Current Loop Goals
1. Reduce the visible shell to `/overview`, `/control`, `/crop-work`, `/resources`, and `/alerts`.
2. Hide `/assistant` and `/settings` from the sidebar and move their entry points into the header/FAB/profile flow.
3. Treat `/rtr` as a control-specific compatibility route instead of a visible primary page.
4. Replace wide stacked page wrappers with a consistent compact tile layout capped at `1320px`.
5. Push the visual system and visible copy toward the coral-first Korean grower UX described in issue `#65`.

## Exact Next Step
1. Update `frontend/src/app/route-meta.ts`, `frontend/src/routes/phytosyncSections.ts`, and the shared shell components so the five-page contract becomes the new source of truth.
2. Then relayout `/overview` and `/control` first, because they expose the new tile system and the `/rtr` absorption most directly.
3. Keep `.rah` runtime snapshots untracked and only commit durable blueprint/control-plane artifacts.
