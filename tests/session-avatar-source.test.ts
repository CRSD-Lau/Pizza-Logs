import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sessionPlayerPage = fs.readFileSync(
  path.join(root, "app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page.tsx"),
  "utf8",
);
const sessionDetailPage = fs.readFileSync(
  path.join(root, "app/uploads/[id]/sessions/[sessionIdx]/page.tsx"),
  "utf8",
);

assert.match(sessionPlayerPage, /PlayerAvatar/);
assert.match(sessionPlayerPage, /getClassIconUrl/);
assert.match(sessionPlayerPage, /class-icons/);
assert.match(sessionPlayerPage, /realmName=/);
assert.match(sessionPlayerPage, /raceName=/);

assert.match(sessionDetailPage, /PlayerAvatar/);
assert.match(sessionDetailPage, /Raid Roster/);
assert.match(sessionDetailPage, /fallbackIconUrl/);

console.log("session-avatar-source tests passed");
