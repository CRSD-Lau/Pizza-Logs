# Reading a Pizza Logs Report

## Raid Session

A canonical report URL identifies the public report and raid date. One uploaded file can contain multiple dated sessions; a second session on the same date receives a numeric suffix.

The session summary uses one first-to-last-event Custom Slice for its headline totals. That slice includes boss pulls, wipes, trash, and downtime so Total Damage, Heal, Damage Taken, and per-player rates share one duration.

## Encounter Metrics

- **Total Damage / DPS:** raw outgoing damage-event amount divided by the encounter duration.
- **Effective Healing / HPS:** gross healing minus overheal; shield absorbs are not silently folded into this primitive.
- **Absorbs / APS:** attributed numeric absorbed damage from supported shield evidence.
- **Heal / H+A PS:** explicitly labeled comparison view equal to effective healing plus attributed absorbs.
- **Damage Taken:** raw incoming damage-event amount.
- **Boss/target damage:** supplemental breakdown by destination; it does not replace the headline total.

Kill duration ends at the boss death timestamp. Other encounter windows end at the last boss-destination event, preventing stale markers, boss outgoing attacks, or unrelated trash from extending the pull.

## Evidence and Unknowns

Difficulty is determined per attempt from boss-specific spell ranks, explicit encounter rules, and limited valid marker fallback. Conflicting or missing evidence is `UNKNOWN`. Unsupported modes such as Hodir Hard Mode and Sartharion drake modes are not guessed.

Pet and absorb ownership are conservative. Summon or owner-exclusive spell evidence is required for pets; overlapping shields are marked ambiguous or unattributed where the log cannot prove ownership.

## Player Detail

Player pages and report detail can show per-spell/target output, role/spec evidence, aura uptime, consumables, power gains, deaths with the preceding incoming-damage window, class peers, records, and cached Warmane gear.

Warmane gear is best effort. A stale badge means Pizza Logs is showing the last healthy cached snapshot because the upstream request was unavailable.

## Historical Reports

Reports are parsed snapshots. A later parser correction does not rewrite existing database rows. Re-upload the original source log after deployment to produce a report under the new contract.

The exact analytical definitions and intentional differences are documented in [parser-contract.md](../parser-contract.md) and [uwu-analytics-parity.md](../uwu-analytics-parity.md).
