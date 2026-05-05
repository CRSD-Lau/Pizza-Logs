# Data Model Quick Reference

Source of truth: `prisma/schema.prisma`.

## Core Relationships

```text
Realm --< Upload --< Encounter --< Participant >-- Player
Realm --< Guild --< Upload
Boss --< Encounter
Player --< Milestone >-- Encounter
GuildRosterMember  (independent Warmane roster cache)
ArmoryGearCache    (independent Warmane gear cache)
WowItem            (local AzerothCore item metadata)
WeeklySummary      (materialized weekly aggregates)
```

## Main Tables

| Table | Purpose |
|---|---|
| `realms` | Realm identity such as Lordaeron/warmane/wotlk |
| `guilds` | Guild identity scoped to a realm |
| `uploads` | Uploaded log file metadata, hash, status, raw line count, session damage |
| `encounters` | Parsed boss pulls with outcome, difficulty, duration, totals, and session index |
| `participants` | Per-player encounter stats, role, DPS/HPS, deaths, spell/target JSON |
| `players` | Combat-log player rows scoped to realm |
| `bosses` | Seeded WotLK boss definitions, slugs, raids, sort order |
| `milestones` | Current and superseded DPS/HPS record ranks |
| `weekly_summaries` | Materialized weekly top DPS/HPS and boss-kill data |
| `guild_roster_members` | Cached Warmane guild roster rows |
| `armory_gear_cache` | Cached Warmane gear snapshots per character/realm |
| `wow_items` | Static WotLK item metadata imported from AzerothCore `item_template` |

## Important Constraints

- `Realm`: unique `(name, host)`.
- `Guild`: unique `(name, realmId)`.
- `Upload.fileHash`: unique SHA-256 for file-level deduplication.
- `Encounter.fingerprint`: unique encounter-level deduplication key.
- `Participant`: unique `(encounterId, playerId)`.
- `Player`: unique `(name, realmId)`.
- `GuildRosterMember`: unique `(normalizedCharacterName, guildName, realm)`.
- `ArmoryGearCache`: unique `(characterKey, realm)`.
- `WowItem.itemId`: primary key as string.

## JSON Shapes

`Participant.spellBreakdown`:

```json
{
  "Frost Strike": {
    "damage": 1234567,
    "healing": 0,
    "hits": 45,
    "crits": 12,
    "school": 16
  }
}
```

`Participant.targetBreakdown`:

```json
{
  "Lord Marrowgar": {
    "damage": 890000,
    "hits": 120,
    "crits": 34
  }
}
```

`ArmoryGearCache.gear` stores an `ArmoryCharacterGear` snapshot:

```json
{
  "characterName": "Example",
  "realm": "Lordaeron",
  "sourceUrl": "https://armory.warmane.com/character/Example/Lordaeron/summary",
  "fetchedAt": "2026-05-05T00:00:00.000Z",
  "items": [
    {
      "slot": "Head",
      "name": "Item Name",
      "itemId": "50000",
      "itemLevel": 264,
      "quality": "epic",
      "equipLoc": "INVTYPE_HEAD",
      "iconUrl": "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_01.jpg"
    }
  ]
}
```

## Operational Notes

- Upload-derived data can be cleaned from admin controls; roster, gear cache, and item metadata are persistent support data.
- `wow_items.iconName` is backfilled from Warmane/Zamimg icon data and should not be overwritten by the AzerothCore import.
- Roster-only characters can have player pages even without a `players` row.
