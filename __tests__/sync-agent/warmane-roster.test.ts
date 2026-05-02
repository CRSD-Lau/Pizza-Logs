import { describe, it, expect } from "vitest";
import { normalizeRosterJson } from "../../sync-agent/warmane/roster";

describe("normalizeRosterJson", () => {
  it("returns null for non-object", () => {
    expect(normalizeRosterJson("string")).toBeNull();
  });

  it("returns null for missing roster key", () => {
    expect(normalizeRosterJson({ members: [] })).toBeNull();
  });

  it("returns null for empty roster array", () => {
    expect(normalizeRosterJson({ roster: [] })).toBeNull();
  });

  it("parses a valid roster", () => {
    const data = {
      roster: [
        { name: "Lausudo", class: "Paladin", level: 80, rankName: "Officer", rankOrder: 2 },
        { name: "Writman", class: "Warlock", level: 80 },
      ],
    };
    const result = normalizeRosterJson(data);
    expect(result).toHaveLength(2);
    expect(result![0]).toMatchObject({
      characterName: "Lausudo",
      normalizedCharacterName: "lausudo",
      guildName: "Pizza Warriors",
      realm: "Lordaeron",
      className: "Paladin",
      rankName: "Officer",
      rankOrder: 2,
    });
    expect(result![1].characterName).toBe("Writman");
  });

  it("trims whitespace from names", () => {
    const data = { roster: [{ name: "  Lausudo  " }] };
    const result = normalizeRosterJson(data);
    expect(result![0].characterName).toBe("Lausudo");
    expect(result![0].normalizedCharacterName).toBe("lausudo");
  });

  it("filters out entries without names", () => {
    const data = {
      roster: [{ class: "Paladin" }, { name: "Lausudo" }],
    };
    const result = normalizeRosterJson(data);
    expect(result).toHaveLength(1);
    expect(result![0].characterName).toBe("Lausudo");
  });

  it("sets correct armoryUrl", () => {
    const data = { roster: [{ name: "Lausudo" }] };
    const result = normalizeRosterJson(data);
    expect(result![0].armoryUrl).toBe(
      "https://armory.warmane.com/character/Lausudo/Lordaeron/summary"
    );
  });
});
