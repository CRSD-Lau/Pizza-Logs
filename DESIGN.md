# Pizza Logs Frontend Contract

Author: Neil Mitchell

Last modified by: Neil Mitchell

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
- The cinematic intro is an optional **Watch guild intro** action on the homepage. It must not block browsing, request media before activation, or autoplay for reduced-motion users.
- Directories sort alphabetically and expose search/filter controls before results. Historical award ranks must never masquerade as current overall player rankings.
- Report shortcuts lead to stable section IDs, open the relevant disclosure and move keyboard focus to its heading control. Every major disclosure exposes a real heading.
- Short-pull counting rules use a compact disclosure; their count and included/excluded state remain visible.
- The full desktop navigation appears only when the logo, search and links fit without overlapping. Narrower viewports use a named menu, with current-page and Escape/focus behavior.
- Numeric comparisons state boss/difficulty/time scope. Weekly attempt rows retain their actual date and a link to the source fight.

## Numbers, units, time and lists

Use the display helpers in `lib/utils.ts` on public pages, admin pages, previews and expanded details. Stored numbers, ranking eligibility and sort inputs remain unchanged.

| Value | Standard | Example |
|---|---|---|
| Counts, list positions and gear | Grouped whole numbers using `en-US`; counts, ranks, character/item levels and GearScore do not use K/M | `1,234` hits; GearScore `4,250` |
| Damage, healing, absorbs and power amounts | Exactly two decimals; use K for thousands and M for millions, with comma grouping within the displayed value. Keep M for larger amounts; never switch to B | `58.00`, `13.93K`, `4.20M`, `1,234.57M` |
| Rates | The same two-decimal K/M format; a visible metric appears in a column header or beside the value on mobile | `13.93K DPS`, `58.00 HPS` |
| Percentages | Exactly two decimals; show `<0.01%` for a positive value below 0.01; reserve `0.00%` for a measured zero | `7.30%`, `0.00%`, `<0.01%` |
| Missing measurements | An em dash with accessible `Unavailable` text via `NumericValue`; explain missing qualifying attempts in the surrounding copy | No boss kills: unavailable average; measured zero amount or rate: `0.00` |
| Charts, tables and tooltips | Use the same two-decimal metric format on every surface, with correct K/M threshold rollover | `999,999` becomes `1.00M` |
| File size | Binary units, matching the 1,024 divisor; scaled units have exactly two decimals and byte counts remain whole | `1.50 KiB`, `2.00 MiB`, `512 B` |
| Recorded date/time | Month name, day, year; 24-hour time explicitly labelled UTC; ranges crossing midnight include both dates | `Sep 4, 2026, 23:04:10 UTC` |
| Decimal seconds | Exactly two decimals with an explicit seconds unit; never use K/M for time | `1.25 s`, `0.00 s` |
| Elapsed time | `M:SS`, adding hours when needed; retain `H:MM:SS.mmm` in precise analysis | `4:27`, `2:05:03`, `1:04:29.712` |

- Comparison columns align numbers to the right and use tabular digits. Responsive layouts must retain complete formatted values and visible units, not rely on desktop-only headings or hover titles.
- Formatting affects display only. Sort by the original numeric values before rounding; values that display alike do not become analytical ties. A positive amount or rate below `0.01` displays `<0.01` instead of appearing to be zero.
- Name totals consistently: **Damage**, **Effective healing**, **Absorbs**, **Healing + absorbs**, and **Damage taken**. DPS/HPS/APS remain distinct; HPS means effective healing per second. Spell out **Healing + absorbs /s** where that combined rate appears.
- Kill/wipe counts use words (`12 kills / 5 wipes`). Never use K for kills alongside K meaning thousands. Death counts use `1 death` or `2 deaths` with a visible separator from the next statistic.
- Count labels use correct singular/plural forms. Numeric count badges and pagination totals use the same grouping rules.
- Identifiers (item IDs, recovery codes and URL segments) retain their original digits; they are not measurements. Long-form calendar dates may be used in raid titles; recorded timestamps use the shared UTC format.
- Current comparison lists display positions as `#1`, `#2`, etc., with an accessible position label. These are ordered positions in the displayed result set; historical awards retain their recorded rank and explicit historical scope. Formatting must not redefine ties or change stored awards.
- Alphabetical directories have no performance position. Recent-history lists run newest first; boss-order grouping must be named as such. Any cutoff states the visible range and provides pagination or disclosure for the remaining entries.
- Derive a rate only from a valid recorded duration. A zero/missing duration is unavailable evidence, not a one-second fight. Stored participant rates are not recomputed by presentation code.

## Tokens

Use the semantic colors in the `@theme` block of `app/globals.css` and the fonts/configuration in `tailwind.config.mjs`. Do not add literal interface colors inside components when a semantic, class, school, status, or surface token exists.
