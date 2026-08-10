# Difficulty Detector v2

Pizza Logs classifies difficulty only after encounter segmentation. Each attempt
produces exactly one mode: `10N`, `10H`, `25N`, `25H`, or `UNKNOWN`.

The factual spell-rank behavior was checked against `CRSD-Lau/uwu-logs` commit
`f32f00e917ad6baba9012704dc9e41afe578426d`. The reference checkout contains no
license file, so Pizza Logs uses an independently structured implementation and
does not copy its source text.

## Internal result

Every parsed encounter carries auditable detector metadata. The parser response
uses camel-case JSON:

```json
{
  "mode": "25H",
  "confidence": "high",
  "evidence": ["spell:70825=>25H"],
  "reason": "One unambiguous boss-specific spell mode matched",
  "detectorVersion": "pizza-difficulty-v2"
}
```

`parser/difficulty_detector.py` is the canonical mapping and rules file. Spell
families are stored as `boss -> mode -> set[spell ID]`; alternative families are
unioned into the same set. This avoids synthetic `boss2` keys and preserves both
the Mana Burn and Fan of Knives Faction Champions families.

## Evidence order

1. Aggregate every boss-specific difficulty spell ID in the segmented attempt.
2. Return the unique matching mode when all spell evidence agrees.
3. Return `UNKNOWN` when spell evidence conflicts.
4. Apply an explicit encounter-specific Ulduar rule.
5. Use a valid `ENCOUNTER_START` mode only as a documented fallback for a boss
   and mode represented in the spell-rank mapping.
6. Otherwise return `UNKNOWN`; raid size alone does not silently imply Normal.

Filename, uploader, realm, and form metadata never influence difficulty.

## Ulduar

- Raid size uses a valid encounter group size first, then distinct player GUIDs.
- XT-002, Assembly of Iron, Thorim, Mimiron, and General Vezax use hard-mode-only
  markers. A missing marker is explicitly size-matched Normal for these fights.
- Freya is Hard Mode only when all three configured Elder markers for the raid
  size appear.
- Yogg-Saron is Hard Mode with zero or one distinct Keeper buff and Normal with
  two or more.
- Hodir Hard Mode is unsupported and returns `UNKNOWN`.
- Sartharion drake modes are unsupported and return `UNKNOWN`.

## Ranking protection

An apparent kill with `UNKNOWN` difficulty is retained as an attempt but its
outcome is emitted as `UNKNOWN`, not `KILL`. Existing leaderboard, weekly, boss,
player, and milestone queries therefore cannot rank it as a valid kill.

## Tests

`parser/tests/test_difficulty_detector.py` covers every boss/mode pair present in
the mapping, all four ICC modes, ToC and Ruby Sanctum, every supported Ulduar
hard-mode rule, conflicts, missing evidence, malformed input, alternative spell
families, Faction Champions, and per-attempt isolation.
