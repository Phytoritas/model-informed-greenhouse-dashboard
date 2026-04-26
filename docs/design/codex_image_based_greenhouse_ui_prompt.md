# Codex Prompt: Greenhouse Decision Dashboard Landing UI from Reference Image

## Context
Target repository: `Phytoritas/model-informed-greenhouse-dashboard`

Reference image: `docs/design/design_system_ui_ux_dashboard_mockup.png`

Compatibility note: `docs/design/UIUX_example.png` is the original imported source image. Keep
`docs/design/design_system_ui_ux_dashboard_mockup.png` available as the canonical prompt path so
automation and future sessions can resolve the file named in this instruction.

The image is the visual source of truth for the new frontend landing/overview UI. It shows a 16:9 design-system board with:
- Left: design system tokens, typography, icon style, status chips
- Center: actual landing page / dashboard overview mockup
- Right: UI components, data cards, form controls, spacing/grid

## Goal
Improve the frontend landing page / overview shell into a readable agriculture decision dashboard. The result should feel like a practical greenhouse command center, not a generic SaaS landing page.

Keep the existing product/domain logic and data flows. Translate the visual reference into the repo’s existing React + Vite + Tailwind/CSS structure.

## First, inspect before editing
1. Identify the current landing/overview route and shell components.
2. Identify canonical style files and tokens, especially:
   - `frontend/src/styles/theme.css`
   - `frontend/tailwind.config.js`
   - shared components for buttons, cards, panels, tabs, charts, layout
3. Summarize what you will change before making edits.

## Visual direction
Implement the reference image as a functional responsive UI:

### Brand / theme
Use readable sans-serif fonts only. Do not use script, decorative serif, or calligraphy.
Preferred stack:
`Pretendard, Noto Sans KR, Inter, Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif`

Use a warm agriculture-tech palette:
```css
--color-bg: #FAF7F2;
--color-surface: #FFFFFF;
--color-surface-warm: #FFF1E9;
--color-blush: #FFE7E1;
--color-primary: #B42318;
--color-primary-soft: #FEE4E2;
--color-tomato: #E74D3C;
--color-terracotta: #C94F3D;
--color-success: #15803D;
--color-sage: #A8C5A1;
--color-olive: #596B4A;
--color-text: #1F2933;
--color-muted: #667085;
--color-border: #E7DED6;
```

Important:
- Use red/tomato mainly for CTAs, high-impact actions, and critical states.
- Use green/sage for normal, growth, live, recommended, and positive trend states.
- Use charcoal for core text.
- Do not use light red as small text on light backgrounds; use `#B42318` or darker for accessibility.

### Landing page sections
Build or refactor the landing/overview page into this hierarchy:

1. `TopNavigation`
   - Logo: `PhytoSync`
   - Nav: Home, Dashboard, Insights, Scenarios, Knowledge, Contact
   - CTA: `Open Dashboard`

2. `HeroDecisionBrief`
   - Badge: `Live Greenhouse Intelligence`
   - Headline: `Today’s greenhouse decisions, made simple.`
   - Supporting copy: climate, crop, and market insight in one place.
   - Primary CTA: `View Dashboard`
   - Secondary CTA: `Explore Scenarios`
   - Right visual: soft greenhouse background or existing asset/gradient + floating dashboard preview card.

3. `LiveMetricStrip`
   - Cards: Air Temp, RH, CO₂, VPD, DLI, Irrigation, Yield Outlook
   - Include values, units, trend chips, and compact sparkline visuals where available.

4. `TodayActionBoard`
   - Cards:
     - Ventilation Adjustment
     - Irrigation Timing
     - Disease Risk
     - RTR Scenario
   - Each card should show icon, short explanation, severity/recommendation chip, and action button.

5. `ScenarioOptimizerPreview`
   - Compare Baseline vs Optimized Scenario A.
   - Show current setpoints, AI recommended setpoints, and yield outlook delta.

6. `WeatherMarketKnowledgeBridge`
   - Three cards:
     - Weather Forecast
     - Market Insight
     - Knowledge Hub
   - Link or route to existing features where possible.

7. `FinalCTA`
   - Text: `One platform. Better decisions. Stronger harvests.`
   - Email input + `Get Started Free` or dashboard entry CTA.

8. `Footer`
   - Product name, copyright, useful links, status.

### UI components to standardize
Create or update reusable UI primitives if the repo already has them:
- Button: primary, secondary, ghost, disabled, danger
- Card / Panel
- MetricCard
- AlertCard
- TrendCard
- StatusChip
- Input / SearchInput / Select
- SectionHeader
- Responsive grid helpers

Do not create a parallel design system if the repo already has canonical components. Reuse and extend existing components.

## Responsive rules
- Mobile `<640px`: single column; hero visual below text; action and metric cards stacked.
- Tablet `640–1023px`: two-column layout where possible; metrics wrap 2–3 per row.
- Desktop `>=1024px`: hero split layout and dense dashboard grids.
- Wide `>=1280px`: max-width container and 12-column rhythm.

## Accessibility requirements
- Use semantic HTML: `header`, `main`, `section`, `nav`, `footer`.
- All buttons and links must have visible focus states.
- Inputs need labels or accessible labels.
- Keep text contrast WCAG-friendly:
  - core text on ivory/surface should be charcoal
  - CTA text should use white on dark red `#B42318`
  - green status text should use darker green `#15803D`
- Charts/sparklines cannot rely on color alone; include labels or text deltas.

## Implementation constraints
- Preserve existing API/data integrations.
- Prefer existing data hooks and fixtures.
- If real data is not available in the landing page, use typed sample data close to existing dashboard models.
- Avoid adding heavy dependencies.
- Use lucide-react icons if already present.
- Keep animations subtle and optional.

## Validation
After edits, run:

```bash
npm run --prefix frontend lint
npm run --prefix frontend build
```

If tests exist for affected components, run them too:

```bash
npm run --prefix frontend test
```

If Playwright or browser preview is available, compare the implemented screen with the reference image at:
- 390px mobile
- 768px tablet
- 1440px desktop

## Completion summary required
Report:
1. Files changed
2. Components created/updated
3. Design tokens added/changed
4. Commands run and results
5. Any assumptions or unresolved gaps
