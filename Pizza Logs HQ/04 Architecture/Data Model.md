# Data Model — Quick Reference

> Fast lookup. Full schema in `prisma/schema.prisma`.

---

## Entity Map

```
Realm ──< Upload ──< Encounter ──< Participant >── Player
           │               │              │
           └── Guild       └── Boss       └── Milestone
                           └── Milestone
```

---

## Tables

### Realm
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | e.g. "Lordaeron" |
| host | String | e.g. "warmane" |
| expansion | String | "wotlk" |
| Unique: | (name, host) | |

### Upload
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| filename | String | original filename |
| fileHash | String (unique) | SHA-256 of file → dedup |
| fileSize | Int | bytes |
| status | Enum | PENDING / PARSING / DONE / FAILED / DUPLICATE |
| rawLineCount | Int? | total log lines |
| parsedAt | DateTime? | when processing completed |
| realmId | String? | FK |
| guildId | String? | FK |

### Encounter
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| uploadId | String | FK |
| bossId | String | FK |
| fingerprint | String (unique) | SHA-256 dedup hash |
| outcome | Enum | KILL / WIPE / UNKNOWN |
| difficulty | String | "10N" "10H" "25N" "25H" |
| groupSize | Int | |
| sessionIndex | Int | 0-based, >60 min gap = new session |
| durationSeconds | Int | |
| startedAt | DateTime | |
| endedAt | DateTime | |
| totalDamage | Float | |
| totalHealing | Float | |
| totalDamageTaken | Float | |

### Participant
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| encounterId | String | FK |
| playerId | String | FK |
| role | Enum | DPS / HEALER / TANK / UNKNOWN |
| totalDamage | Float | |
| totalHealing | Float | |
| damageTaken | Float | |
| dps | Float | |
| hps | Float | |
| deaths | Int | |
| critPct | Float | 0-100 |
| spellBreakdown | Json? | `{spellName: {damage, healing, hits, crits, school}}` |
| targetBreakdown | Json? | `{mobName: {damage, hits, crits}}` |
| Unique: | (encounterId, playerId) | |

### Player
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | character name |
| class | String? | WoW class string |
| realmId | String? | FK |
| Unique: | (name, realmId) | |

### Boss
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String (unique) | display name |
| slug | String (unique) | URL slug |
| raid | String | raid zone name |
| sortOrder | Int | ICC=10-40, Naxx=700-741 |
| wowBossId | Int? | NPC ID from log |

### Milestone
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| playerId | String | FK |
| encounterId | String | FK |
| metric | Enum | DPS / HPS |
| value | Float | |
| rank | Int | 1 = server best |
| difficulty | String? | |
| supersededAt | DateTime? | null = current record |

---

## JSON Field Shapes

### spellBreakdown
```json
{
  "Frost Strike": { "damage": 1234567, "healing": 0, "hits": 45, "crits": 12, "school": 16 },
  "Obliterate":   { "damage": 987654,  "healing": 0, "hits": 30, "crits": 8,  "school": 1  }
}
```

### targetBreakdown
```json
{
  "Lord Marrowgar":     { "damage": 890000, "hits": 120, "crits": 34 },
  "Bone Spike":         { "damage": 45000,  "hits": 15,  "crits": 4  }
}
```

---

## Key Constraints

- `Upload.fileHash` unique → file-level dedup
- `Encounter.fingerprint` unique → encounter-level dedup
- `Milestone.supersededAt = null` → current active records only
- `Participant (encounterId, playerId)` unique → one row per player per fight
