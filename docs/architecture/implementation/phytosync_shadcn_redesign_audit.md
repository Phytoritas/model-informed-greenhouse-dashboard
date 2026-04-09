# PhytoSync Shadcn Redesign Audit

## Prompt Intake
- Source prompt: `codex_phytosync_shadcn_redesign_prompt.md`
- Design references: `stitch/verdant_core/DESIGN.md`, `stitch/overview_dashboard`, `stitch/field_management`, `stitch/resource_tracking`, `stitch/alerts_notifications`
- Active baseline: merged issue `#43` SmartGrow command-center shell on top of the landed actuator-first RTR / advisor / knowledge surfaces

## Stitch Reference Read

### Structural traits
- Left-fixed navigation + glassy top status bar + large editorial hero block
- Intentional asymmetry rather than equal-weight card walls
- Tonal layering and stacked-sheet panels instead of boxy bordered widgets
- Navigation entries read as product sections, not raw feature toggles

### Card / bar / chart rhythm
- One dominant story card per fold, then smaller support cards
- Big label + big number + one short operational message
- Charts are quiet, low-grid, soft-background decision tools
- Floating glass is limited to shell surfaces, not sprayed across every card

## Current Frontend Gap

### Already strong
- App shell, dashboard cards, weather/forecast/market/alert secondary surfaces
- Live recovery seams for advisor / knowledge / produce / RTR
- Korean-first command-center direction exists in parts of the UI

### Still weak or inconsistent
- Brand and IA still speak in the old `SmartGrow / Advisor / Assistant / Knowledge` vocabulary
- Top-level navigation is workspace-based rather than page-based (`overview/control/growth/...`)
- Visible jargon still leaks through: `confidence`, `Knowledge`, `Assistant`, `RTR studio`, `optimizer`
- `App.tsx` still owns too much page structure and route copy inline
- Some Korean strings in recent shell code are mojibake-corrupted and must be repaired
- shadcn-style open-code primitives are not yet present under `components/ui/`
- Page-local tabs and route-synced navigation are still missing

## Remove Or Hide For Farmer-Facing UI
- `knowledge`, `RAG`, `evidence`, `provenance`, `retrieval`, `optimizer`, `confidence`
- Internal capability language such as “surface”, “contract”, or “runtime” from primary labels
- Equal-weight generic tool launcher cards when a recommended next action can be shown instead

## Data Priority To Preserve
1. Today / tonight / this week action direction
2. Greenhouse control state and risk
3. Growth progress and work pressure
4. Harvest / market / resource economics
5. Alerts and question workflow

## Implementation Direction

### Phase 1
- Introduce route-synced `PhytoSync` navigation and shadcn-style UI primitives
- Rename top-level sections to farmer-facing Korean labels
- Repair mojibake in shell-facing Korean copy

### Phase 2
- Recompose App shell around `/overview`, `/control`, `/growth`, `/nutrient`, `/protection`, `/harvest`, `/resources`, `/alerts`, `/ask`
- Add page-local section tabs and action-first page intros
- Rebrand visible launcher / assistant / advisor labels

### Phase 3
- Sweep remaining visible jargon and English fallback
- Harmonize panel headers, CTA hierarchy, and chart framing
- Re-run live smoke and capture updated screenshots
