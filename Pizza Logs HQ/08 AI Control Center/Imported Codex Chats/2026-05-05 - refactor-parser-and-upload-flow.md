# Refactor parser and upload flow

> Imported from local Codex session logs on 2026-05-05. This is a readable chat digest, not the raw JSONL transcript.

## Metadata

- Session date: 2026-05-05
- Thread id: `019df83e-24d7-70d1-b291-9d87dec60e83`
- Original cwd: `C:\Users\neil_\OneDrive\Desktop\PizzaLogs`
- Source log: `C:\Users\neil_\.codex\sessions\2026\05\05\rollout-2026-05-05T10-05-15-019df83e-24d7-70d1-b291-9d87dec60e83.jsonl`
- Imported user turns: 1
- Imported assistant final replies: 1
- Tool/command events omitted: 179

## Discussion Digest

## User

You are working in my Pizza Logs repository.

Goal:
Perform a full deep-dive, test-driven refactor of parser.py and the complete wowcombatlog.txt upload parsing flow.

Reference repositories:
- https://github.com/Ridepad/uwu-logs
- https://github.com/bkader/Skada-WoTLK

Context:
Pizza Logs is a WotLK 3.3.5a / Warmane-focused combat log parser. The parser must be accurate for uploaded end-user WoWCombatLog.txt files and should align as much as possible with in-game Skada-style results while also learning from uwu-logs parsing architecture.

Primary objectives:
1. Audit current parser.py and every code path that touches uploaded WoWCombatLog.txt files.
2. Study uwu-logs and Skada-WoTLK as reference implementations.
3. Refactor parser.py into clear, testable parsing modules if needed.
4. Build a proper test suite before and during refactor.
5. Preserve existing production functionality unless it is objectively wrong.
6. Do not guess silently. Document assumptions.

Must analyze and improve:
- Total damage
- Useful damage
- DPS
- Total healing
- HPS
- Overkill/overheal treatment, if available in log data
- Pets/guardians attribution
- Encounter start/end detection
- Wipe detection
- Kill detection
- Multi-attempt sessions
- Boss attempts where raid wipes on Heroic then switches to Normal
- Bosses where difficulty changes mid-session
- 10-man vs 25-man detection
- Normal vs Heroic detection
- Encounter ordering
- Boss aliases / NPC ID handling
- Trash vs boss segmentation
- Partial logs
- Duplicate uploads
- Malformed or truncated lines
- Unsupported lines should not crash parsing

Reference behavior:
- Use Skada-WoTLK to understand how in-game damage, healing, DPS, HPS, useful damage, and segment boundaries are typically represented.
- Use uwu-logs to understand WotLK combat log parsing structure, boss detection, aura/event handling, and upload-oriented parsing.
- Do not blindly copy code. Use both repos as validation references and architectural guidance.
- Cite specific files/functions from the reference repos in internal notes or docs when their logic influences changes.

Expected implementation approach:
1. Create a working branch, for example:
   parser-refactor-tdd

2. Inspect current repo:
   - parser.py
   - upload handlers
   - database write paths
   - models/schema
   - existing tests
   - leaderboard calculations
   - raid sessions page logic
   - admin upload logic
   - any docs describing parser assumptions

3. Create a parser audit note before changing logic:
   docs/parser-audit.md

Include:
   - current parser flow
   - known weaknesses
   - reference repo findings
   - proposed target architecture
   - risk areas
   - test coverage plan

4. Add or improve tests:
   - Unit tests for individual combat log line parsing
   - Unit tests for damage aggregation
   - Unit tests for healing aggregation
   - Unit tests for DPS/HPS windows
   - Unit tests for encounter segmentation
   - Unit tests for wipe vs kill detection
   - Unit tests for heroic-to-normal fallback cases
   - Unit tests for 10m/25m and normal/heroic detection
   - Regression tests for any current known Pizza Logs bugs
   - Fixture-based tests using small synthetic WoWCombatLog.txt samples
   - If safe, add larger anonymized sample fixtures

5. Parser architecture target:
   Prefer separating responsibilities:
   - raw line tokenizer
   - event normalizer
   - actor resolver
   - spell/event classifier
   - encounter detector
   - difficulty detector
   - attempt/session segmenter
   - damage/healing aggregator
   - metric calculator
   - persistence adapter

6. Metrics rules:
   Damage:
   - total_damage = all valid damage credited to actors during an encounter segment
   - useful_damage = damage that meaningfully contributes to boss/encounter progress; exclude irrelevant padding where identifiable
   - keep rules explicit and configurable because â€œusefulâ€ can be encounter-specific

   DPS:
   - calculate from encounter active duration
   - avoid inflated DPS from full uploaded-file duration
   - define whether player active time or encounter duration is used
   - document the chosen rule

   Healing:
   - total_healing should distinguish raw healing vs effective healing if log data supports it
   - overheal should not inflate effective healing if overheal fields are present
   - HPS should use encounter duration unless existing app convention says otherwise

7. Encounter/difficulty rules:
   - Prefer explicit ENCOUNTER_START / ENCOUNTER_END where present.
   - Warmane/WotLK logs may be inconsistent, so add fallback heuristics.
   - Use boss NPC IDs, boss damage taken, boss death, raid combat state, and encounter boundaries as supporting signals.
   - Correctly split attempts when a wipe occurs.
   - Correctly treat a later normal kill after heroic wipes as a separate normal kill.
   - Do not merge heroic wipes and normal kills into one result.
   - Do not bucket normal attempts under heroic or heroic attempts under normal.
   -

[Truncated for vault import.]

## Assistant

Implemented and published the parser refactor on `codex-dev`.

Draft PR: [#10 harden combat log parser flow](https://github.com/CRSD-Lau/Pizza-Logs/pull/10)
Commit: `0cb9103 refactor: harden combat log parser flow`
Branch status: clean, pushed to `origin/codex-dev`

Main changes:
- Added [docs/parser-audit.md](C:/Users/neil_/OneDrive/Desktop/PizzaLogs/docs/parser-audit.md) with current flow, Skada/uwu reference findings, risks, assumptions, and test plan.
- Added [parser/combat_log_events.py](C:/Users/neil_/OneDrive/Desktop/PizzaLogs/parser/combat_log_events.py) for tokenizer/skipped-line handling.
- Added [parser/combat_metrics.py](C:/Users/neil_/OneDrive/Desktop/PizzaLogs/parser/combat_metrics.py) for damage/healing field extraction.
- Refactored [parser/parser_core.py](C:/Users/neil_/OneDrive/Desktop/PizzaLogs/parser/parser_core.py) behind tests.
- Fixed malformed-line reporting, short explicit-marker encounters, `/parse-stream` filename validation, and heroic-wipe-to-normal-kill difficulty bleed.
- Updated README, parser contract docs, vault handoff/current focus, parser architecture, security checklist, decision log, and known issues.

Validation passed:
- Parser pytest: `133 passed, 1 warning`
- TypeScript type-check
- ESLint
- Next production build
- `git diff --check`
- Staged secret scan: no matches

Remaining risks are documented: absorbs still need separate implementation, useful damage needs more encounter-specific rules over time, and hard server-side upload size enforcement remains a follow-up.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="codex-dev"}
::git-create-pr{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="codex-dev" url="https://github.com/CRSD-Lau/Pizza-Logs/pull/10" isDraft=true}
