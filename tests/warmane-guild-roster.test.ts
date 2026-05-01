import assert from "node:assert/strict";
import {
  buildWarmaneGuildApiUrls,
  normalizeWarmaneGuildRosterPayload,
  parseWarmaneGuildRosterHtml,
  toGuildRosterRecord,
  upsertGuildRosterMembers,
} from "../lib/warmane-guild-roster";

const urls = buildWarmaneGuildApiUrls("PizzaWarriors", "Lordaeron");
assert.equal(
  urls[0],
  "https://armory.warmane.com/api/guild/Pizza+Warriors/Lordaeron/summary",
);
assert.equal(
  urls[1],
  "https://armory.warmane.com/api/guild/PizzaWarriors/Lordaeron/summary",
);

const jsonResult = normalizeWarmaneGuildRosterPayload({
  roster: [
    {
      name: "Azyva",
      race: "Night Elf",
      class: "Druid",
      level: "80",
      rank: "Small Council",
    },
    {
      name: "../Bad",
      race: "Human",
      class: "Warrior",
      level: "80",
      rank: "Core",
    },
  ],
}, {
  guildName: "PizzaWarriors",
  realm: "Lordaeron",
});

assert.equal(jsonResult.ok, true);
if (jsonResult.ok) {
  assert.equal(jsonResult.members.length, 1);
  assert.deepEqual(jsonResult.members[0], {
    characterName: "Azyva",
    normalizedCharacterName: "azyva",
    guildName: "PizzaWarriors",
    realm: "Lordaeron",
    className: "Druid",
    raceName: "Night Elf",
    level: 80,
    rankName: "Small Council",
    armoryUrl: "https://armory.warmane.com/character/Azyva/Lordaeron/summary",
    lastSyncedAt: jsonResult.members[0].lastSyncedAt,
  });
}

const emptyJsonResult = normalizeWarmaneGuildRosterPayload({ roster: [] }, {
  guildName: "PizzaWarriors",
  realm: "Lordaeron",
});
assert.deepEqual(emptyJsonResult, {
  ok: false,
  message: "Warmane roster response did not include usable guild members.",
});

const htmlResult = parseWarmaneGuildRosterHtml(`
  <table>
    <tr>
      <td><a href="/character/Striq/Lordaeron/summary">Striq</a></td>
      <td><img alt="Night Elf"></td>
      <td><img title="Druid"></td>
      <td>80</td>
      <td>Core 1</td>
    </tr>
    <tr>
      <td><a href="https://armory.warmane.com/character/Cyd/Lordaeron/summary">Cyd</a></td>
      <td>Draenei</td>
      <td>Shaman</td>
      <td>79</td>
      <td>Trial</td>
    </tr>
  </table>
`, {
  guildName: "PizzaWarriors",
  realm: "Lordaeron",
});

assert.equal(htmlResult.ok, true);
if (htmlResult.ok) {
  assert.equal(htmlResult.members.length, 2);
  assert.equal(htmlResult.members[0].characterName, "Striq");
  assert.equal(htmlResult.members[0].raceName, "Night Elf");
  assert.equal(htmlResult.members[0].className, "Druid");
  assert.equal(htmlResult.members[0].rankName, "Core 1");
  assert.equal(htmlResult.members[1].characterName, "Cyd");
}

assert.deepEqual(parseWarmaneGuildRosterHtml("<html>No roster here</html>", {
  guildName: "PizzaWarriors",
  realm: "Lordaeron",
}), {
  ok: false,
  message: "Warmane roster page did not include usable guild members.",
});

const record = toGuildRosterRecord({
  characterName: "Azyva",
  normalizedCharacterName: "azyva",
  guildName: "PizzaWarriors",
  realm: "Lordaeron",
  className: "Druid",
  raceName: "Night Elf",
  level: 80,
  rankName: "Small Council",
  armoryUrl: "https://armory.warmane.com/character/Azyva/Lordaeron/summary",
  lastSyncedAt: new Date("2026-04-30T12:00:00.000Z"),
});

assert.equal(record.where.normalizedCharacterName_guildName_realm.normalizedCharacterName, "azyva");
assert.equal(record.create.characterName, "Azyva");
assert.equal(record.update.rankName, "Small Council");

async function main() {
  const upserts: unknown[] = [];
  await upsertGuildRosterMembers({
    guildRosterMember: {
      upsert: async (operation: unknown) => {
        upserts.push(operation);
        return operation;
      },
    },
  }, [record.create, { ...record.create, characterName: "Azyva" }]);

  assert.equal(upserts.length, 2);
  assert.equal(
    (upserts[0] as typeof record).where.normalizedCharacterName_guildName_realm.realm,
    "Lordaeron",
  );

  console.log("warmane-guild-roster tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
