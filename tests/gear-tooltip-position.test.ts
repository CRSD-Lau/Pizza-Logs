import assert from "node:assert/strict";
import fs from "node:fs";
import { getGearTooltipPosition } from "../components/players/GearItemCard";

const anchor = {
  left: 260,
  top: 430,
  right: 620,
  bottom: 506,
  width: 360,
  height: 76,
} as DOMRect;

assert.deepEqual(
  getGearTooltipPosition(anchor, { width: 448, height: 220 }, { width: 900, height: 620 }),
  { left: 260, top: 194 },
  "positions the tooltip above the hovered card when it would overflow below the viewport",
);

assert.deepEqual(
  getGearTooltipPosition(anchor, { width: 448, height: 180 }, { width: 640, height: 900 }),
  { left: 176, top: 518 },
  "keeps the tooltip inside the right viewport edge",
);

const cardSource = fs.readFileSync("components/players/GearItemCard.tsx", "utf8");

assert.match(
  cardSource,
  /createPortal\([\s\S]*document\.body/,
  "renders the tooltip into document.body instead of inside the gear card wrapper",
);

assert.match(
  cardSource,
  /fixed z-2147483647/,
  "renders the tooltip as a top-level fixed overlay above app sections",
);

console.log("gear-tooltip-position tests passed");
