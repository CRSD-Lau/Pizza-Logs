# Pizza Logs Frontend Contract

Pizza Logs uses a dark raid-log workspace with a restrained gold accent. The interface should feel like an analytical tool first and a Warcraft artifact second.

## Typography and contrast

- `text-primary` is for outcomes, values, and main reading text.
- `text-secondary` is for meaningful supporting copy.
- `text-dim` is reserved for non-critical metadata and meets AA contrast on the standard dark surfaces.
- Use `text-secondary` on colored leaderboard fills; standard-surface contrast does not transfer to those backgrounds. Destructive-action text uses `danger-light` while borders retain `danger`.
- Meaningful interface text has a 12px absolute minimum; normal metadata should be 14px.

## Page rhythm

- Use `PageShell` for the shared responsive top padding and section cadence.
- Use `PageHeader` for page titles, descriptions, and actions.
- Use `PageSection` for major open-surface groups. Sections are separated by spacing and a divider, not another card.

## Surfaces and hierarchy

- Use `DataPanel` only for interactive tables, meters, or dense data that benefits from a bounded workspace.
- Supporting information belongs on the page surface with dividers.
- Metric summaries need one highlighted outcome. Secondary metrics remain quiet and must not all compete as equal cards.
- Long directories and cross-boss reports must paginate or use accessible disclosure.

## Interaction and responsive behavior

- Buttons, fields, filters, pagination, and compact navigation expose a minimum 44px interaction box.
- Clickable rows must use native button or link semantics, a visible focus state, and `aria-expanded` when they reveal details.
- Dense analytics collapse to a two-column summary on small screens. Desktop-only columns may be hidden when their values remain available in the primary or expanded view.
- The cinematic intro is homepage-only and runs once per browser session. Deep links are never blocked by it.

## Tokens

Use the semantic colors in the `@theme` block of `app/globals.css` and the fonts/configuration in `tailwind.config.mjs`. Do not add literal interface colors inside components when a semantic, class, school, status, or surface token exists.
