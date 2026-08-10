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
| Damage, DPS, healing, HPS | Matched | Frozen Skada-aligned totals and exact fixture hashes remain the authority. |
| Per-spell breakdown | Matched | Damage/healing, hits, crits, and school are stored per participant. |
| Damage by target / boss damage | Matched generically | Every target is stored; encounter UI highlights boss-only damage where applicable. |
| Absorbs / APS | Implemented conservatively | Numeric absorbed damage is separate from healing; active shield evidence controls attribution and uncertainty is surfaced. |
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

1. New analytical surfaces cannot mutate the frozen damage/healing baseline.
2. Missing or conflicting evidence stays unknown/unattributed.
3. Absorbs never inflate healing.
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
