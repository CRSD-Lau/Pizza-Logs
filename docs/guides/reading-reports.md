# Reading a Pizza Logs Report

Author: Neil Mitchell

Last modified by: Neil Mitchell

## Reading Numbers and Lists

Damage, healing, absorbs, power amounts and rates use exactly two decimal places,
with K for thousands and M for millions: `58.00`, `13.93K`, `4.20M`. Larger amounts
keep M with comma grouping, such as `1,234.57M`; the display does not switch to B.
Percentages use two decimals too, such as `7.30%` or `0.00%`. A positive percentage
below 0.01% displays `<0.01%` instead of implying zero contribution; tiny positive
amounts and rates likewise display `<0.01`. An em dash means the measurement is
unavailable; `0.00` is an actual recorded zero. Sorting uses the original values,
so two values rounded to the same text may occupy different list positions.

Counts, ranks, character/item levels and GearScore remain whole numbers with comma
grouping. File sizes use binary units with two decimals after scaling, such as
`1.50 KiB` or `2.00 MiB`; byte counts remain whole. Dates include the year and
timestamps use labelled UTC. Decimal seconds use two places, such as `1.25 s` or
`0.00 s`. Clock-style durations such as `4:27`, `2:05:03` and precise
`1:04:29.712` retain their existing formats.

Current comparison lists show numbered positions within the stated metric and scope.
Alphabetical directories have no performance position. Recent player history is newest
first. Expanded spell breakdowns start with 15 spells and expose the remainder through
**Show more**; chart details provide a **View chart values** table without hovering.
Chart axes, tooltips and tables use the same compact metric format.
The [frontend contract](../../DESIGN.md#numbers-units-time-and-lists)
defines the same rules for public pages, previews and admin history.

## Raid Session

A canonical report URL identifies the public report and raid date. One uploaded file can contain multiple dated sessions; a second session on the same date receives a numeric suffix.

Use **On this page** to jump to player totals, boss fights, targets, the full session or the roster. Shortcuts open collapsed sections and support keyboard navigation. Similar shortcuts appear on encounter, boss and player reports.

The main session summary and **Boss Kill Breakdown** include successful boss fights
only. Total Damage, Healing + absorbs, Damage Taken and the mob breakdown use stored `KILL`
encounters. Adds and mechanics within those fights still count; wipes, unknown
outcomes and between-fight trash do not contribute to the summary.

Player DPS, Healing + absorbs /s (effective healing plus attributed absorbs per second) and DTPS
use each player's summed output divided by the combined duration of all successful
fights. Every player uses this same duration, including fights they sat out; these
are raid-wide contribution rates, not averages of individual fight rates. Precise
milliseconds take priority, with valid legacy seconds as a fallback. Missing kill
duration makes rates unavailable without hiding totals. A session with no recorded
kills shows an empty summary rather than substituting wipe totals.

Click any player-table column heading to sort it; click again to reverse the order.
Mobile cards have equivalent sort and direction controls. Player links open the
player's report across all recorded boss attempts, and the encounter list and roster
remain available separately.

The collapsed **Full Session Breakdown** retains first-to-last-event totals,
including boss pulls, wipes, trash and downtime, with its own sortable player table.
Rates in this section use the entire session duration. Older reports without stored
full-session analytics retain any known full-session damage total and show an
availability notice for missing metrics; their kill summary still works from stored
encounters. Full-session trash spell and target breakdowns are not stored.

## Short Pulls and Wipe Counts

By default, public wipe and pull counts exclude a recorded **WIPE lasting less than
one minute with zero recorded participant deaths**. Reports show the number of
short pulls separately. Expand the short-pull **Details**, then choose **Include short pulls** to restore them to the
counts and encounter list; their individual reports remain accessible throughout.

Confirmed kills, wipes with any recorded death, and unknown outcomes remain
included, even below one minute. Exactly one minute is included. Precise recorded
milliseconds take priority, with valid legacy seconds used when milliseconds are
unavailable. Missing or invalid duration/death evidence does not trigger exclusion.

This is a reversible counting policy, not proof of why a pull ended. Preparation,
accidental engagements and genuine short attempts can look alike, especially in a
partial log. Stored outcomes and combat metrics are unchanged. The optional
full-session totals still include short pulls; the main kill summary is unaffected
by the toggle, and best-performance values retain their existing scope.
The policy works on existing reports without re-uploading or changing database rows.
Admin inventory and the raw encounter API continue to expose the recorded attempts.

Public boss, weekly and player statistics include `shortPullCount`; use
`includeShortPulls=1` to include these attempts in their counts. The raw
`/api/encounters` array and direct encounter URLs retain their existing behavior.

## Encounter Metrics

- **Total Damage / DPS:** raw outgoing damage-event amount divided by the encounter duration.
- **Effective Healing / HPS:** gross healing minus overheal; shield absorbs are not silently folded into this primitive.
- **Absorbs / APS:** attributed numeric absorbed damage from supported shield evidence.
- **Healing + absorbs:** the combined total of effective healing and attributed absorbs. **Healing + absorbs /s** is its per-second rate.
- **Damage Taken:** raw incoming damage-event amount.
- **Boss/target damage:** supplemental breakdown by destination; it does not replace the headline total.

Kill duration ends at the boss death timestamp. Other encounter windows end at the last boss-destination event, preventing stale markers, boss outgoing attacks, or unrelated trash from extending the pull.

## Evidence and Unknowns

Difficulty is determined per attempt from boss-specific spell ranks, explicit encounter rules, and limited valid marker fallback. Conflicting or missing evidence is `UNKNOWN`. Unsupported modes such as Hodir Hard Mode and Sartharion drake modes are not guessed.

Pet and absorb ownership are conservative. Summon or owner-exclusive spell evidence is required for pets; overlapping shields are marked ambiguous or unattributed where the log cannot prove ownership.

## Player Detail

The player directory is alphabetical, with name and class filters. Guild roster search filters all members before pagination. Neither directory assigns an overall performance rank. Raid history has pagination by upload, keeping every session from an upload together and stating the visible window.

Profile and encounter awards describe the rank **when achieved**, for the named boss, difficulty, metric and period. They are historical awards, not continuously recalculated current standings. Use the linked leaderboards for current comparisons.

Leaderboards and boss views default to all difficulties combined. Select a difficulty to compare one mode; unknown difficulty remains explicitly separate. Weekly tables rank individual attempts, can contain the same player more than once, and link to each fight using its actual recorded date. Effective HPS remains separate from attributed absorbs.

Player pages and report detail can show per-spell/target output, role/spec evidence, aura uptime, consumables, power gains, deaths with the preceding incoming-damage window, class peers, records, and cached Warmane gear.

Spell-detail bars compare each ability's damage or healing volume with the largest ability in that expanded row. DPS rows use damage volume; effective-healing and combined-healing rows use healing volume, with absorbs shown separately. **Overall crit** is the participant's critical-hit percentage across recorded output events. Spell rows label their combined stored damage/healing event count and critical percentage as total events and overall crit rather than using the older `%c` abbreviation.

Aura Uptime and Power Gains can be filtered by player and ability using partial text or the provided suggestions. Long result sets show 50 rows at a time with an explicit show-more control. Aura rows name the raid member the aura was observed on, which is not necessarily the caster. Power rows name the raid member who received the resource. Invalid entries and player/ability combinations with no matching row are reported inline.

Warmane gear is best effort. A stale badge means Pizza Logs is showing the last healthy cached snapshot because the upstream request was unavailable.

## Historical Reports

Reports are parsed snapshots. A later parser correction does not rewrite existing database rows. Re-upload the original source log after deployment to produce a report under the new contract.

The exact analytical definitions and intentional differences are documented in [parser-contract.md](../parser-contract.md) and [uwu-analytics-parity.md](../uwu-analytics-parity.md).
