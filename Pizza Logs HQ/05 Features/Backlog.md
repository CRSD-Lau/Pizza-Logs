# Feature Backlog

> Prioritized. The top of this list is what gets built next.

---

## Priority Stack (do in order)

| # | Feature | Why | Effort |
|---|---|---|---|
| 1 | Footer text fix | Wrong info, 5 min fix | XS |
| 2 | Admin auth (secret middleware) | Security | S |
| 3 | Absorbs tracking | Parser: `SPELL_ABSORBED` events | L |
| 4 | Damage mitigation stats | Parser: `SPELL_MISSED` subtypes (ABSORB, BLOCK, PARRY, DODGE) | L |
| 5 | Consumable tracking | Buff applications from known consumable spell IDs | XL |
| 6 | Gunship + Saurfang fix | `High Overlord Saurfang` alias overlap — investigate log events | M |
| 7 | Marrowgar DPS over-count | ~9.45k vs uwu-logs 9.3k — root cause not found | M |

---

## Backlog (not prioritized yet)

| Feature | Notes |
|---|---|
| Discord milestone bot | Post #1 records to Discord channel |
| Fastest kill records | Per boss, per difficulty — shortest duration kills |
| Attendance tracking | Who was in each raid, % attendance over time |
| Hall of Fame | All-time #1s in a dedicated page |
| Public guild pages | Share leaderboards without login |
| Multiple realm support | Already in schema, just needs UI |
| Real-time parse speed display | Show MB/s or lines/s during upload |
| Death recap | Who died and when in each encounter |
| Wipe analysis | Why did the raid wipe? (% boss HP, deaths, etc.) |
| Export to CSV | Download encounter data |

---

## Shipped ✅ (moved here to keep backlog clean)

See [[Feature Status]] for full shipped feature list.

---

## Related
- [[Technical Debt]] — known shortcuts that will need fixing
- [[Feature Status]] — what's already built

---

## Deprioritized / Won't Do

| Feature | Reason |
|---|---|
| Heroic detection | Impossible without ENCOUNTER_START on Warmane |
| Gunship Battle detection | Impossible |
| Sprint / agile tooling | One person, no need |
