# Player Gear Quick Look

Pizza Logs exposes current Warmane equipment from the class avatar shown beside a player. The avatar is a 44px button with a small shield badge. Hover it with a mouse, focus it with the keyboard, or tap it to load the quick look.

On desktop, the quick look mirrors the Wrath character equipment pane: eight armor slots flank Warmane's dressed 3D character model and the weapon slots sit along the bottom. Empty slots remain visible, so the layout does not shift between characters. Narrow screens use a compact two-column equipment list so every item remains readable and do not load the heavier model viewer.

The tooltip shows:

- the Armory class icon and class, race, and guild identity;
- the character's Warmane appearance and equipped-item display models on desktop;
- equipped item icons, slots, and names;
- GearScoreLite and average item level;
- the snapshot time and whether the response is a cached fallback.

Warmane's public profile exposes a WebGL model recipe rather than a stable portrait image URL. Pizza Logs parses only bounded numeric appearance fields, the race/sex model ID, and equipment display IDs from the already-requested profile HTML. The viewer runs inside a script-only sandboxed iframe with a restrictive Content Security Policy, no same-origin permission, no referrer, and no access to Pizza Logs data or the parent page. The class icon remains visible underneath and is the automatic fallback when the recipe or viewer is unavailable.

## Data path

The client lazily calls `GET /api/players/[name]/gear`. The route rejects arbitrary names and only serves a character already present in `players` or `guild_roster_members`. Pizza Logs then reads or refreshes `armory_gear_cache` through the Warmane character JSON endpoint, reads the display recipe from the matching public profile, and enriches the equipment from local `wow_items` metadata.

Quick looks use a five-minute Armory refresh window and a five-minute in-browser response cache. If Warmane is unavailable, the last healthy database snapshot is returned with a stale label. A page render does not fan out Armory requests for every player; only an opened quick look performs the read.

Tampermonkey, bookmarklets, admin secrets, and open Warmane tabs are not part of this viewing path. Gear refresh is fully on demand, and guild-roster refresh is a first-party authenticated admin action.
