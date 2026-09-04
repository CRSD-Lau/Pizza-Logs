# UwU Analytical Parity Evidence

Author: Neil Mitchell

Pizza Logs preserves independently computed canonical combat primitives. UwU
compatibility requires a named input, configuration, reference revision, and
comparison surface. Matching a written formula is insufficient.

The corpus demonstrates **9 exact cases, 11 mismatching cases, zero tolerated
cases, and seven unproven surface categories**. Most exact cases cover small
session primitives; one covers a Marrowgar 10N kill. Complete Tier-1 or live
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
| Encounter order, mode, result, duration, totals | One dense Marrowgar 10N kill matches. Missing-mode behavior and three old synthetic fixtures differ. |
| Roster and pet rollup | One summon matches; ambiguous ownership and recipient-only roster inference remain unproven. |
| Duration precision | Exact milliseconds in named cases. Reference negative year-rollover duration is not copied into canonical data. |
| Display, rounding, sorting | Reference strings recorded. Pizza locale/rounding differs; no displayed parity claim. |
| Damage/heal/taken/healed player detail | Routes/features inspected; per-recipient/per-spell normalization incomplete. |
| Per-spell, per-target, boss/useful damage | These are separate from headlines. Full breakdown and boss-specific useful rules remain unproven. |
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
assertion, `run`, exits **1**, preserving 11 failures and seven skipped/unproven
categories in `parity.junit.xml`. Both produce `parity.json` and `parity.md`.
There is no numeric tolerance or implicit golden update.

The corpus includes 17 original scenarios plus all three existing synthetic
fixture files: damage, healing recipients, overheal, misses, environmental
damage, pets, absorbs, event kinds, overkill, friendly fire, UTF-8, unknown mode,
back-to-back pulls, separate dates, and year rollover. It does not replace a
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
