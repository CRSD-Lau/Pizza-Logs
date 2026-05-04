import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const component = readFileSync(path.join(root, "components", "intro", "FrozenLogbookIntro.tsx"), "utf8");
const globals = readFileSync(path.join(root, "app", "globals.css"), "utf8");
const layout = readFileSync(path.join(root, "app", "layout.tsx"), "utf8");

assert.match(component, /FROZEN_INTRO_STORAGE_KEY = "pizzaLogsFrozenIntroSeen"/);
assert.match(component, /INTRO_DURATION_MS = 2300/);
assert.match(component, /localStorage\.getItem\(FROZEN_INTRO_STORAGE_KEY\)/);
assert.match(component, /localStorage\.setItem\(FROZEN_INTRO_STORAGE_KEY, "1"\)/);
assert.match(component, /INTRO_REPLAY_PARAM = "intro"/);
assert.match(component, /URLSearchParams\(window\.location\.search\)/);
assert.match(component, /searchParams\.get\(INTRO_REPLAY_PARAM\) === "1"/);
assert.match(component, />\s*Skip\s*</);
assert.match(component, /Raid data, forged from combat logs\./);

assert.match(layout, /import \{ FrozenLogbookIntro \}/);
assert.match(layout, /<FrozenLogbookIntro \/>/);

assert.match(globals, /\.frozen-intro-overlay/);
assert.match(globals, /\.frozen-intro-particle/);
assert.match(globals, /\.reveal-item/);
assert.match(globals, /\.boss-reveal-item/);
assert.match(globals, /prefers-reduced-motion: reduce/);

console.log("frozen-intro source tests passed");
