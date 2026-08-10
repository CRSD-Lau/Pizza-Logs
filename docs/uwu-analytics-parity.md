# UwU Analytical Parity Contract

Pizza Logs uses Skada-WoTLK as the authority for combat totals and the public
UwU Logs project as a reference for which analytical questions raiders expect a
report to answer. The inspected UwU revision is
`f32f00e917ad6baba9012704dc9e41afe578426d` from
<https://github.com/CRSD-Lau/uwu-logs>.

The inspected repository has no root license file. Pizza Logs therefore uses
independently written implementations and does not copy UwU source code.

## Parity Matrix

| Analytical surface | Pizza Logs status | Contract |
|---|---|---|
| Damage, DPS, healing, HPS | Matched by explicit definition | Outgoing damage/effective healing retain Skada primitives; encounter scope and public report definitions follow the adopted UwU comparison contract. |
| Per-spell breakdown | Matched | Damage/healing, hits, crits, and school are stored per participant. |
| Damage by target / boss damage | Matched generically | Every target is stored; encounter UI highlights boss-only damage where applicable. |
| Damage taken | Matched | Headline taken uses the raw reported incoming amount, while outgoing damage keeps the established effective/useful formula. |
| Absorbs / APS / H+A | Implemented conservatively | Numeric absorbed damage stays separate from healing; reports also expose explicit healing + absorbs totals/rates. Active and just-removed shield evidence controls attribution and uncertainty is surfaced. |
| Encounter boundaries | Matched | The pull ends at the last meaningful boss activity, preventing stale markers or post-fight trash from inflating duration and roster. |
| Pet ownership | Matched conservatively | Summons and owner-exclusive spells establish ownership; permanent pet creature IDs propagate only from that evidence. |
| Spec and role | Implemented conservatively | WotLK spell signatures plus output/taken evidence; ties and weak evidence are not guessed. |
| Aura uptime | Implemented | Application count, seconds, and encounter percentage per player/aura. |
| Consumables | Implemented | Curated consumable auras are separated from the general aura table. |
| Power gains | Implemented | Energize events grouped by recipient, spell, and power type. |
| Death analysis | Implemented | Death timestamp plus the prior 15 seconds of observed incoming damage. |
| Player comparison | Existing | Session player charts compare the subject with same-class players on kills. |
| Top/PvE statistics | Existing | Boss leaderboards, milestones, weekly summaries, and player per-boss bests. |
| Boss-specific "useful damage" formulas | Deliberately partial | Generic target/boss damage is stable. UwU's boss-specific opinionated formulas are not treated as Skada totals and require separately evidenced rules/tests. |
| Global spell search | Not yet a dedicated route | Spell data is available inside encounter/player breakdowns, but there is no cross-report spell-search page. |
| Special mechanic reports | Not universal | Valkyr grabs, Defile targets, portal stacks, and similar mechanics need boss-specific fixtures before becoming ranking data. |

## Non-Negotiable Compatibility Rules

1. New analytical surfaces cannot silently change a metric definition; every adopted definition is frozen by regression coverage.
2. Missing or conflicting evidence stays unknown/unattributed.
3. Absorbs never inflate effective healing; the combined H+A metric is always labeled.
4. Boss-specific useful metrics are supplemental labels, never replacements for
   Skada-aligned totals.
5. Parser changes require focused or fixture tests and the complete parser gate.

## Regression Gates

- `parser/tests/baselines/analytics-v1.json` freezes the pre-upgrade analytical
  output for all canonical fixtures.
- `parser/tests/test_analytics_baseline.py` verifies exact normalized hashes.
- `parser/tests/test_parser_core.py` covers the enrichment paths, including
  absorbs, ambiguity fields, role/spec, aura uptime, consumables, power gains,
  incoming damage, and death timing.
- `parser/tests/baselines/uwu-2026-07-31-lausudo.json` captures the five-pull
  public Lausudo comparison report, including headline totals and the player
  checks that exposed the Saurfang boundary/ownership failures.
- `parser/tests/test_uwu_parity_baseline.py` locks that external acceptance
  baseline independently from synthetic parser fixtures.

## 2026-07-31 Lausudo Acceptance Baseline

The public UwU report contains five pulls: Marrowgar, Lady Deathwhisper,
Gunship, and two Saurfang wipes. The frozen baseline records each pull's mode,
result, millisecond duration, damage, effective healing, and damage taken. It
also locks the previously divergent Saurfang player checks for Shadowcake,
Azyia, and Gowron.

The original combat ZIP is not publicly downloadable from UwU. Synthetic
fixtures therefore prove each repaired behavior independently. After this PR
deploys, re-uploading Neil's original ZIP is the required real-log acceptance
test; existing database rows are historical results and are not rewritten.
