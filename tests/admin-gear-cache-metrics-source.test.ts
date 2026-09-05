import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(path.join(process.cwd(), "app", "admin", "page.tsx"), "utf8");
const actions = readFileSync(path.join(process.cwd(), "app", "admin", "actions.ts"), "utf8");
const clearButton = readFileSync(path.join(process.cwd(), "app", "admin", "ClearGearCacheButton.tsx"), "utf8");

assert.match(source, /label="Cached Snapshots"/);
assert.match(source, /label="Latest Live Refresh"/);
assert.match(source, /orderBy:\s*\{\s*lastSuccessAt:\s*"desc"\s*\}/);
assert.match(source, /formatDateTimeUtc\(latestGearRefresh\.lastSuccessAt\)/);
assert.doesNotMatch(source, /Server Refresh Errors|recentGearErrors/);
assert.match(source, /<ClearGearCacheButton \/>/);
assert.match(actions, /clearArmoryGearCache/);
assert.match(actions, /db\.armoryGearCache\.deleteMany\(\)/);
assert.doesNotMatch(actions.match(/clearArmoryGearCache[\s\S]*?syncGuildRosterFromAdmin/)?.[0] ?? "", /db\.(?:player|guildRosterMember|wowItem|upload)\./);
assert.match(clearButton, /Yes, clear snapshots/);
assert.match(clearButton, /Quick looks will request each character from Warmane again/);

console.log("admin gear cache metrics source tests passed");
