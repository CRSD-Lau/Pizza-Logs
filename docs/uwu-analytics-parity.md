# UwU Analytical Parity Evidence

Author: Neil Mitchell

Last modified by: Neil Mitchell

Pizza Logs preserves independently computed canonical combat primitives. UwU
compatibility requires a named input, configuration, reference revision, and
comparison surface. Matching a written formula is insufficient.

The corpus demonstrates **14 exact cases, 12 mismatching cases, zero tolerated
cases, and seven unproven surface categories**. Most exact cases cover small
session primitives; six now cover named Marrowgar encounters, including all four
modes, a 10N wipe and one spell/target breakdown. Complete Tier-1 or live
UwU parity is **not demonstrated**.

## Reference and provenance

The inspected [UwU revision](https://github.com/CRSD-Lau/uwu-logs/tree/4c046d266b85ad833ab4d70addb0b6f1a16647e3)
is `4c046d266b85ad833ab4d70addb0b6f1a16647e3` (commit subject `6.41.10`). Previous
documentation referenced `f32f00e917ad6baba9012704dc9e41afe578426d`, 35 commits
behind. That commit subject is not a verified version of the live deployment.

Ordinary HTTP observations on 2026-09-04 returned 200 for `/upload`, `/top`,
`/character`, and `/pve_stats`; `/`, `/ladder`, and the historical report returned
403. No restriction was bypassed, no private log uploaded, and no live
adversarial testing performed. The live deployment commit is unknown.

No root license or GitHub-detected redistribution license was found. The pinned
[README self-hosting instructions](https://github.com/CRSD-Lau/uwu-logs/blob/4c046d266b85ad833ab4d70addb0b6f1a16647e3/README.md)
affirmatively document local execution. The reference ran privately from an
unmodified snapshot with separate dependencies/data and an egress guard. No
reference source, comments, templates, algorithms, or assets are vendored.

The original adapter invokes the reference's own text session splitter,
normalizer, and report methods. It captures values and display strings; it
does not recreate formulas as a substitute oracle. Source Git blob hashes are
verified before execution. Goldens contain only synthetic observations and
provenance.

## Changes since the old reference

The [35-commit comparison](https://github.com/CRSD-Lau/uwu-logs/compare/f32f00e917ad6baba9012704dc9e41afe578426d...4c046d266b85ad833ab4d70addb0b6f1a16647e3)
and changed reference surfaces were re-inspected:

| Area | Observed changes | Consequence |
|---|---|---|
| Encounter separation | Multi-boss overkill boundaries, Ulduar minimum durations, upload gap handling | Old encounter claims require paired inputs. |
| Difficulty/kills | Freya guardian evidence, Yogg lookback, Mimiron components, Valithria spell ranks, Algalon evidence | One ICC example cannot validate every mode. |
| Normalization/time | NUL handling, timestamp errors, Unicode archive names | Malformed and archive paths require separate fixtures. |
| Damage/mechanics | Freya useful damage and Mimiron target groups | Canonical and useful damage must stay distinct. |
| Pets | Nil-target ownership guard | One summon does not prove universal ownership parity. |
| Auras/characters | Aura definitions and character aura/point output | Character and aggregate ranking remain unpaired. |
| Upload/storage | Archive decoding, names, cached-file recovery, processing changes | Report-method evidence does not validate upload admission or safety. |

## Parity matrix

“Observed” includes live navigation/HTTP and pinned route/template inspection
where live reports were inaccessible. It never means a live pass.

| Surface | Evidence/status |
|---|---|
| Session damage, effective healing, Heal, incoming damage | Exact in named simple fixtures; environmental omission corrected. Absorb/friendly-fire/event-set cases differ. |
| Session boundaries | Successive dates now separate correctly; a 24-hour gap is paired. Universal raid grouping is unproven. |
| Encounter order, mode, result, duration, totals | Dense Marrowgar 10N/10H/25N/25H kills and a 10N wipe match. Missing-mode, sparse-target segmentation and three old synthetic fixtures differ. |
| Roster and pet rollup | One summon matches; ambiguous ownership and recipient-only roster inference remain unproven. |
| Duration precision | Exact milliseconds in named cases. Reference negative year-rollover duration is not copied into canonical data. |
| Display, rounding, sorting | Reference strings recorded. Pizza locale/rounding differs; no displayed parity claim. |
| Damage/heal/taken/healed player detail | Routes/features inspected; per-recipient/per-spell normalization incomplete. |
| Per-spell, per-target, boss/useful damage | Two damage spells and two distinct targets match in one named 10N encounter. Crossed spell-by-target matrices, same-name entities, full breakdown and boss-specific useful rules remain unproven. |
| Casts/actions and spell search | Source routes observed; no universal timeline or cross-report search claim. |
| Consumables, all/player auras, powers | Pizza implementations exist; paired coverage missing. |
| Deaths and prior damage | Environmental death context has a regression; full death-page parity unproven. |
| Entity/player/pet class, spec, role | Conservative canonical inference remains; reference presentation is not universally matched. |
| Player comparison | Filters, grouping, rounding, ranking unpaired. |
| Valk grabs, Lady spirits, UCM, ToC valks | Reference routes identified; complete Pizza mechanics coverage not claimed. |
| Top/characters/PvE statistics | Live pages accessible; historical aggregate datasets/display unpaired. |
| Logs list, calendar, ladder, realm/guild | Navigation/source inspected; live ladder/reports inaccessible, aggregate semantics unproven. |
| Archive extraction, upload acceptance, publication | Outside the analytical adapter; independent Pizza security tests remain mandatory. |

## Reproducible lab

The [lab instructions](../parser/parity/README.md) describe commands, schema,
capture, source integrity, and drift behavior. The [manifest](../parser/parity/manifest.json)
is authoritative for case-specific claims and reviewed differences.

From `parser/`:

```bash
python -m parity verify --output-dir /tmp/pizza-parity
python -m parity run --output-dir /tmp/pizza-parity-full
```

`verify` checks exact claims and fingerprints of reviewed mismatches. The full
assertion, `run`, exits **1**, preserving 12 failures and seven skipped/unproven
categories in `parity.junit.xml`. Both produce `parity.json` and `parity.md`.
There is no numeric tolerance or implicit golden update.

The corpus includes 23 original scenarios plus all three existing synthetic
fixture files: damage, healing recipients, overheal, misses, environmental
damage, pets, absorbs, event kinds, overkill, friendly fire, UTF-8, unknown mode,
back-to-back pulls, separate dates, year rollover, all four Marrowgar modes, a
mode-identified wipe, and dense/sparse two-target cases. It does not replace a
representative real multi-raid corpus.

## Canonical corrections and retained differences

- Environmental damage now uses shifted fields for incoming totals, separate
  absorbs, and death context. It never contributes outgoing damage.
- Explicit dates separate raids at equal clock times on successive dates;
  December/January UTC years remain correct. Invalid/backwards input is counted
  instead of receiving invented timestamps.
- UwU's omitted `DAMAGE_SHIELD`/`DAMAGE_SPLIT` session amounts, minimal shield
  attribution, negative year-rollover duration, and ambiguous roster/mode
  behavior remain recorded differences. Canonical primitives are preserved.
- No general UwU-compatible projection is exposed: the evidence is too narrow
  to apply reference quirks safely across historical data.


## Closeout evidence expansion and classifications

The additional captures used the same unmodified pinned reference, Python 3.11.9,
synthetic byte identity checks and denied network/process egress. Four mode/outcome
cases and one damage-detail case add five exact comparisons. The dense damage-detail
case records **Frostbolt 99,190; Fireball 97,099; Lord Marrowgar 163,499; Bone Spike
32,790**, agreeing exactly with Pizza. Reference amounts come from its actual report
detail methods, including separate target-filter calls. Untouched responses remain
in the golden, separate from the name-keyed numerical comparison.

The first shorter two-target experiment produced no reference encounter while
Pizza retained one. That input remains a twelfth explicit mismatch; increasing
activity to obtain the paired detail case did not remove the inconvenient observation.
Neither case proves which segmentation threshold is preferable for authentic sparse
Warmane fights.

| Mismatch case(s) | Disposition | Required next evidence/action |
|---|---|---|
| `marrowgar-dense-wipe`, `marrowgar-dense-kill`, `back-to-back-pulls`, `multiple-sessions` | Canonical intentional | Preserve UNKNOWN mode/outcome rules; use the separately captured mode-identified cases for valid encounter claims. |
| `friendly-fire` | Canonical intentional | Preserve outgoing enemy damage and recipient incoming damage; pair specific real friendly-fire mechanics separately. |
| `damage-event-coverage` | Canonical intentional | Preserve Skada DAMAGE_SHIELD/DAMAGE_SPLIT amounts; do not silently omit them to match the reference. |
| `year-rollover` | Reference defect in this input | Keep valid positive 30-second elapsed time; re-observe after an explicit reference upgrade. |
| `absorbed-damage` | Insufficient evidence | Pair richer ownership/removal/overlap cases and representative permitted shield logs before assigning a general defect. |
| Three existing ICC/Gunship placeholder fixtures | Insufficient evidence | Obtain authentic creature/mode evidence; modern markers and placeholder IDs do not establish reference behavior. |
| `marrowgar-sparse-targets` | Insufficient evidence | Pair authentic sparse boss activity before changing either segmentation policy. |

No existing synthetic mismatch currently demonstrates an unfixed canonical Pizza defect.
This classification does not resolve full compatibility: all twelve remain failures
of the strict comparison, with six canonical differences, one demonstrated reference
negative-duration defect and five insufficient-evidence cases. The seven broader
unproven categories remain open. No production compatibility projection is added.

## Private representative ICC comparison

A maintainer-supplied combat log was copied with before/after byte-identity checks
and compared privately against the same pinned, unmodified reference. Four
contiguous samples cover a Saurfang heroic kill and wipe, Valithria heroic healing,
and a Lich King normal finale. The reference ran with denied network/process egress
and bounded input, detail calls and output. Private source bytes, identities and
report outputs are excluded from Git and public CI artifacts.

This comparison exposed two canonical corrections in parser `1.1.1`:

- Encounter healing had excluded non-player recipients, despite source-qualified
  effective healing already counting in session totals. Player and known-owned-pet
  healing now includes Valithria, other NPCs, pets and totems. Original synthetic
  regressions cover actor, spell, encounter and rate totals, overheal and separate
  absorbs. For example, a 1,000-point heal with 250 overheal contributes 750 even
  when its recipient is Valithria.
- Fel Synergy provides independently verified owner-exclusive pet evidence.
  Only its `SPELL_HEAL` event with an eligible player source and controlled permanent
  pet recipient qualifies; generic heals and unverified spell IDs remain insufficient.

The private comparison also distinguishes retained behavior from defects. Canonical
damage includes `DAMAGE_SHIELD` and `DAMAGE_SPLIT`; the Lich King scripted finale
remains one attempt through actual boss death. Reference detail `ACTUAL` amounts
subtract overkill while reference headline damage uses raw amounts, so those fields
cannot serve as interchangeable comparison surfaces. Short samples can omit earlier
ownership evidence even with two minutes of surrounding context; compare them with
the complete session before attributing missing pet damage to arithmetic.

These samples do not establish complete parity. Remaining ownership, encounter-window,
absorb, roster and detail differences require separate evidence. This single ICC
session does not cover every mode or other raids, and it does not recover the missing
historical acceptance archive. Public synthetic counts above remain a separate corpus.
Historical stored reports are not automatically recalculated.

## Initial upload groups and Custom Slice boundaries

At the pinned reference revision, upload report grouping and boss-attempt admission
are separate operations. The upload reader processes each text archive member through
its own separator. Candidate chunks use changes in the numeric `HHMMSS` clock value,
then merge or split using sampled destination-player overlap and a 14-hour gap rule.
The clock test is not a literal elapsed-time threshold. A group without sampled
boss evidence is rejected before publication; duplicate and storage admission are
additional steps. See the pinned [upload separator and sampling](https://github.com/CRSD-Lau/uwu-logs/blob/4c046d266b85ad833ab4d70addb0b6f1a16647e3/logs_upload.py#L265-L446)
and [report admission](https://github.com/CRSD-Lau/uwu-logs/blob/4c046d266b85ad833ab4d70addb0b6f1a16647e3/logs_upload.py#L692-L718).

Without explicit start and end indices, the reference's
[default Custom Slice](https://github.com/CRSD-Lau/uwu-logs/blob/4c046d266b85ad833ab4d70addb0b6f1a16647e3/logs_main.py#L181-L193)
covers the entire chosen report, including activity outside accepted boss attempts.
It is not necessarily the entire source file. Different report-group boundaries
change the denominator and available pet context, so compare aligned ranges before
interpreting differences in whole-session totals or rates.

Reference boss attempts ordinarily require
[more than 100 selected boss-event lines](https://github.com/CRSD-Lau/uwu-logs/blob/4c046d266b85ad833ab4d70addb0b6f1a16647e3/logs_fight_separator.py#L242-L257),
with explicit training-target exceptions. Selected lines are not all raw log rows.
This is not a one-minute wipe filter and can omit a brief attempt with substantial
casualties. Pizza's [short-pull count policy](guides/reading-reports.md#short-pulls-and-wipe-counts)
preserves such death-bearing wipes and all stored attempts; it is a deliberate
product distinction, not a claim of matching reference admission.

Additional permitted full-file ICC comparison retained original bytes and checked
all overlapping boss windows, short-attempt admission and initial report groups
privately. Report grouping, ownership, healing/absorb and scripted-finale differences
remain unresolved or intentionally distinct. No private source or report data is
published, and local source observations do not establish the live deployment version.

## Historical acceptance data

The [five-pull acceptance JSON](../parser/tests/baselines/uwu-2026-07-31-lausudo.json)
and integrity test remain. Its source ZIP is unavailable in the safe corpus,
so it cannot count as a differential pass. Old broad “Matched” labels are
retired. A maintainer-designated safe copy of that exact source and a permitted
reference observation are required. Historical database rows are not rewritten.

## Drift and claim changes

`python -m parity check-reference --cache <temp-file>` uses ETags and reports
current, stale, or unavailable repository state. It never runs in normal report
rendering or silently updates the pin. A new revision requires source/license
review, full capture, mismatch review, and explicit golden acceptance.
