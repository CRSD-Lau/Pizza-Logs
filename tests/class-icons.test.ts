import assert from "node:assert/strict";
import { getClassIconUrl } from "../lib/class-icons";

assert.equal(
  getClassIconUrl("Death Knight"),
  "https://cdn.warmane.com/wotlk/icons/large/classicon_deathknight.jpg",
);
assert.equal(
  getClassIconUrl("deathknight"),
  "https://cdn.warmane.com/wotlk/icons/large/classicon_deathknight.jpg",
);
assert.equal(
  getClassIconUrl("  Mage  "),
  "https://cdn.warmane.com/wotlk/icons/large/classicon_mage.jpg",
);
assert.equal(getClassIconUrl("Unknown"), null);
assert.equal(getClassIconUrl(null), null);

console.log("class-icons tests passed");
