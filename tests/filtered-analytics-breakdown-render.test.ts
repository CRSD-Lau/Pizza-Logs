import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FilteredAnalyticsBreakdown } from "../components/analytics/FilteredAnalyticsBreakdown";

const rows = Array.from({ length: 55 }, (_, index) => ({
  id: `row-${index}`,
  player: index % 2 === 0 ? "Lausudo" : "Shadowcake",
  ability: `Ability ${index}`,
  value: `${index}.0%`,
  occurrences: `rendered-marker-${index}`,
}));

const markup = renderToStaticMarkup(React.createElement(FilteredAnalyticsBreakdown, {
  rows,
  abilityLabel: "Aura",
  abilityPlaceholder: "Sacred Shield or Slice and Dice",
  valueLabel: "Uptime",
  occurrencesLabel: "Applications",
  entryLabel: "aura entries",
  playerHelp: "Player means the raid member the aura was observed on.",
}));

assert.match(markup, /role="search"/);
assert.match(markup, /list="[^"]+-players"/);
assert.match(markup, /list="[^"]+-abilities"/);
assert.match(markup, /Showing 50 of 55 aura entries/);
assert.match(markup, /rendered-marker-49/);
assert.doesNotMatch(markup, /rendered-marker-50/);
assert.match(markup, /Show 5 more/);

console.log("filtered analytics breakdown render tests passed");
