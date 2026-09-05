import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const component = readFileSync(path.join(root, "components", "players", "PlayerSearch.tsx"), "utf8");
const nav = readFileSync(path.join(root, "components", "layout", "Nav.tsx"), "utf8");

assert.match(component, /Search players\.\.\./);
assert.match(component, /No players found/);
assert.match(component, /onKeyDown=\{/);
assert.match(component, /router\.push/);
assert.match(component, /addEventListener\("mousedown"/);
assert.match(component, /debounce/i);
assert.match(component, /cacheRef/);
assert.match(component, /getPlayerSearchKeyboardAction/);

assert.match(nav, /import \{ PlayerSearch \}/);
assert.match(nav, /hidden xl:block[\s\S]*<PlayerSearch/);
assert.match(nav, /xl:hidden[\s\S]*<PlayerSearch/);
assert.match(nav, /onNavigate=\{\(\) => setMobileOpen\(false\)\}/);

console.log("player-search-ui-source tests passed");
