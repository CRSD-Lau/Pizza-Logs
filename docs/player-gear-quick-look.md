# Player Gear Quick Look

Author: Neil Mitchell

Last modified by: Neil Mitchell

Pizza Logs exposes current Warmane equipment from the class avatar shown beside a player. The avatar is a 44px button with a small shield badge. Hover it with a mouse, focus it with the keyboard, or tap it to load the quick look.

The same `PlayerAvatar` quick look supplies the guild roster, raid-session roster, encounter roster, player directory, player profile and session-player profile. Its centered model and fallback behavior are shared across these pages.

On desktop, the quick look mirrors the Wrath character equipment pane: eight armor slots flank Warmane's dressed 3D character model and the weapon slots sit along the bottom. Empty slots remain visible, so the layout does not shift between characters. Narrow screens use a compact two-column equipment list so every item remains readable and do not load the heavier model viewer.

The model canvas uses the portrait's measured aspect ratio to fill its height. Camera framing leaves room for tall helmets and places the character lower in the portrait, while the equipment rails, identity overlay and GearScore stay in their existing positions.

The tooltip shows:

- the Armory class icon and class, race, and guild identity;
- the character's Warmane appearance and equipped-item display models on desktop;
- equipped item icons, slots, and names;
- GearScoreLite and average item level;
- the snapshot time and whether the response is a cached fallback.

Warmane's public profile exposes a WebGL model recipe rather than a stable portrait image URL. Pizza Logs parses only bounded numeric appearance fields, the race/sex model ID, and equipment display IDs from the already-requested profile HTML. The viewer runs inside a script-only sandboxed iframe with a restrictive Content Security Policy, no same-origin permission, no referrer, and no access to Pizza Logs data or the parent page. The class icon remains visible underneath and is the automatic fallback when the recipe or viewer is unavailable.

The portrait reports when its model is loading, when Armory supplies no appearance, and when the viewer is unavailable. It waits for the viewer's character-loaded signal as well as a correctly sized canvas before revealing the model. A browser without WebGL receives an explicit message; blocked or stalled viewer scripts time out after 15 seconds. Equipment remains readable in each case. A working 3D viewer requires WebGL and access to Warmane's model assets; changing pages cannot restore a browser's unavailable graphics support.

## Data path

The client lazily calls `GET /api/players/[name]/gear`. The route rejects arbitrary names and only serves a character already present in `players` or `guild_roster_members`. Pizza Logs then reads or refreshes `armory_gear_cache` through the Warmane character JSON endpoint, reads the display recipe from the matching public profile, and enriches the equipment from local `wow_items` metadata.

Quick looks use a five-minute Armory refresh window and a five-minute in-browser response cache. If Warmane's equipment endpoint is unavailable, the last healthy database snapshot is returned with a stale label. The independent public profile response can still supply and persist the appearance recipe, so cached equipment does not unnecessarily fall back to a class icon. A page render does not fan out Armory requests for every player; only an opened quick look performs the read.

If fresh equipment arrives while the profile is unavailable or has no usable appearance recipe, the last valid appearance for that same character and realm is retained in both the response and database cache. The desktop footer labels it **Cached appearance** independently of equipment freshness. Its displayed outfit may be older than the equipment list. A valid new profile replaces it and clears that label; neither a different character nor a different realm can supply this fallback.

Tampermonkey, bookmarklets, admin secrets, and open Warmane tabs are not part of this viewing path. Gear refresh is fully on demand, and guild-roster refresh is a first-party authenticated admin action.
