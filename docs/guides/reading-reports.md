# Reading a Pizza Logs Report

## Raid Session

A canonical report URL identifies the public report and raid date. One uploaded file can contain multiple dated sessions; a second session on the same date receives a numeric suffix.

The session summary uses one first-to-last-event Custom Slice for its headline totals. That slice includes boss pulls, wipes, trash, and downtime so Total Damage, Heal, Damage Taken, and per-player rates share one duration.

## Short Pulls and Wipe Counts

By default, public wipe and pull counts exclude a recorded **WIPE lasting less than
one minute with zero recorded participant deaths**. Reports show the number of
short pulls separately. Choose **Include short pulls** to restore them to the
counts and encounter list; their individual reports remain accessible throughout.

Confirmed kills, wipes with any recorded death, and unknown outcomes remain
included, even below one minute. Exactly one minute is included. Precise recorded
milliseconds take priority, with valid legacy seconds used when milliseconds are
unavailable. Missing or invalid duration/death evidence does not trigger exclusion.

This is a reversible counting policy, not proof of why a pull ended. Preparation,
accidental engagements and genuine short attempts can look alike, especially in a
partial log. Stored outcomes and combat metrics are unchanged. Full-session totals
still include short pulls, and best-performance values retain their existing scope.
The policy works on existing reports without re-uploading or changing database rows.
Admin inventory and the raw encounter API continue to expose the recorded attempts.

Public boss, weekly and player statistics include `shortPullCount`; use
`includeShortPulls=1` to include these attempts in their counts. The raw
`/api/encounters` array and direct encounter URLs retain their existing behavior.

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

Spell-detail bars compare each ability's damage or healing volume with the largest ability in that expanded row. DPS rows use damage volume; HPS and H+A rows use healing volume, with absorbs shown separately. **Overall crit** is the participant's critical-hit percentage across recorded output events. Spell rows label their combined stored damage/healing event count and critical percentage as total events and overall crit rather than using the older `%c` abbreviation.

Aura Uptime and Power Gains can be filtered by player and ability using partial text or the provided suggestions. Long result sets show 50 rows at a time with an explicit show-more control. Aura rows name the raid member the aura was observed on, which is not necessarily the caster. Power rows name the raid member who received the resource. Invalid entries and player/ability combinations with no matching row are reported inline.

Warmane gear is best effort. A stale badge means Pizza Logs is showing the last healthy cached snapshot because the upstream request was unavailable.

## Historical Reports

Reports are parsed snapshots. A later parser correction does not rewrite existing database rows. Re-upload the original source log after deployment to produce a report under the new contract.

The exact analytical definitions and intentional differences are documented in [parser-contract.md](../parser-contract.md) and [uwu-analytics-parity.md](../uwu-analytics-parity.md).
