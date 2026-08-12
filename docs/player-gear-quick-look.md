# Player Gear Quick Look

Pizza Logs exposes current Warmane equipment from the class avatar shown beside a player. The avatar is a 44px button with a small shield badge. Hover it with a mouse, focus it with the keyboard, or tap it to load the quick look.

On desktop, the quick look mirrors the Wrath character equipment pane: eight armor slots flank a central character panel and the weapon slots sit along the bottom. Empty slots remain visible, so the layout does not shift between characters. Narrow screens use a compact two-column equipment list so every item remains readable.

The tooltip shows:

- the Armory class icon and class, race, and guild identity;
- equipped item icons, slots, and names;
- GearScoreLite and average item level;
- the snapshot time and whether the response is a cached fallback.

The central panel currently uses the character's class icon plus race/class identity. Warmane's public profile does expose a WebGL model recipe, but not a stable portrait image URL. Pizza Logs deliberately does not execute Warmane's remote model-viewer JavaScript in the tooltip; the class presentation remains the reliable, isolated fallback until a safe first-party renderer is proven.

## Data path

The client lazily calls `GET /api/players/[name]/gear`. The route rejects arbitrary names and only serves a character already present in `players` or `guild_roster_members`. Pizza Logs then reads or refreshes `armory_gear_cache` through the Warmane character JSON endpoint and enriches the equipment from local `wow_items` metadata.

Quick looks use a five-minute Armory refresh window and a five-minute in-browser response cache. If Warmane is unavailable, the last healthy database snapshot is returned with a stale label. A page render does not fan out Armory requests for every player; only an opened quick look performs the read.

Tampermonkey, bookmarklets, admin secrets, and open Warmane tabs are not part of this viewing path. Gear refresh is fully on demand, and guild-roster refresh is a first-party authenticated admin action.
