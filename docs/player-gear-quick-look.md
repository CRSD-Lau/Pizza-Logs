# Player Gear Quick Look

Pizza Logs exposes current Warmane equipment from the class avatar shown beside a player. The avatar is a 44px button with a small shield badge. Hover it with a mouse, focus it with the keyboard, or tap it to load the quick look.

The tooltip shows:

- the Armory class icon and class, race, and guild identity;
- equipped item icons, slots, and names;
- GearScoreLite and average item level;
- the snapshot time and whether the response is a cached fallback.

## Data path

The client lazily calls `GET /api/players/[name]/gear`. The route rejects arbitrary names and only serves a character already present in `players` or `guild_roster_members`. Pizza Logs then reads or refreshes `armory_gear_cache` through the Warmane character JSON endpoint and enriches the equipment from local `wow_items` metadata.

Quick looks use a five-minute Armory refresh window and a five-minute in-browser response cache. If Warmane is unavailable, the last healthy database snapshot is returned with a stale label. A page render does not fan out Armory requests for every player; only an opened quick look performs the read.

Tampermonkey, bookmarklets, admin secrets, and open Warmane tabs are not required for this normal viewing path. The existing admin userscripts remain optional operational tools for bulk/background gear and guild-roster refreshes.
