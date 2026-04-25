# UI/UX Polish Notes

## Design Direction

The authenticated ViralSnipAI product UI now follows a premium AI SaaS direction: studio-like, focused, creator-friendly, and production-grade. The V1 workflow remains centered on Dashboard, Projects, Create Clip, Exports, Brand Kit, Billing, and Settings.

## Color System

- Light mode uses a soft off-white background, white elevated surfaces, stronger slate text, visible borders, emerald/teal primary actions, and cyan/blue accents.
- Dark mode uses deep charcoal/navy surfaces instead of pure black, readable muted text, visible dark borders, and subtle emerald/cyan glows.
- Violet is kept as a limited AI-special accent rather than a dominant product color.

## Reusable Components

Added shared product UI primitives in `apps/web/components/product-ui/primitives.tsx`:

- `AppCard`
- `PageHeader`
- `EmptyState`
- `StatusBadge`
- `UsageMeter`
- `Stepper`

These are intended for future V1 screens so cards, page headers, status labels, usage bars, and guided workflows stay visually consistent.

## Pages Improved

- Authenticated shell: sidebar, topbar, brand block, active states, and content width.
- Dashboard: studio hero, metrics, recent projects, export status, plan usage, and tips.
- Projects: premium page header, grid cards, empty state, and tip card.
- Create Clip: guided stepper, better project empty state, two-column workspace polish, upload hints, and context panel styling.
- Exports: stronger empty states, page header, status summary, export controls, and preview panel polish.
- Brand Kit: page header, improved settings card, and caption/watermark preview panel.
- Billing: V1-oriented language for Free/Plus/Pro, cleaner shell colors, and hidden V2/V3-style benefit copy.

## Remaining Future Improvements

- Add true project grid/list toggle with persisted preference.
- Add richer export history filters backed by query state.
- Replace legacy SnipRadar-shaped billing usage fields with dedicated V1 media usage fields when the billing model is refactored.
- Add screenshot-based visual regression checks for light/dark mode.
