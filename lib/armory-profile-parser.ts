import { load, type CheerioAPI } from "cheerio";
import { ArmorySectionDataSchema, ArmorySpellSchema, isArmoryCategory, type ArmorySection, type ArmorySectionData } from "./armory-profile";

const clean = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 4000);
const spellId = (href: string | undefined) => Number(href?.match(/(?:^|\/)spell=(\d+)$/)?.[1]);
function document(html: string): CheerioAPI {
  if (Buffer.byteLength(html) > 2 * 1024 * 1024) throw new Error("Armory document too large");
  const $ = load(html);
  $("script,style,noscript,iframe").remove();
  return $;
}
export function matchingArmoryDocument(html: string, name: string, realm: string): CheerioAPI {
  const $ = document(html);
  const match = clean($("title").text()).match(/^Warmane Armory\s*\|\s*Character\s+([A-Za-z]{2,12})\s*@\s*([A-Za-z]{2,24})$/i);
  if (!match || match[1].toLowerCase() !== name.toLowerCase() || match[2].toLowerCase() !== realm.toLowerCase()
    || !$("#character-sheet").length) throw new Error("Armory identity unavailable");
  return $;
}
export function armoryCategories($: CheerioAPI) {
  const categories = new Map<string, string>([["summary", "Summary"]]);
  $("a[data-category],a[data-subcategory]").each((_, element) => {
    const id = $(element).attr("data-category") ?? $(element).attr("data-subcategory") ?? "";
    if (/^\d{1,6}$/.test(id)) categories.set(id, clean($(element).text()));
  });
  if (categories.size > 150) throw new Error("Too many Armory categories");
  return [...categories].map(([id, name]) => ({ id, name }));
}
function safeReference(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const match = href.match(/^(?:https?:)?\/\/wotlk\.cavernoftime\.com\/(item|spell|achievement)=(\d{1,7})$/);
  return match ? `https://wotlk.cavernoftime.com/${match[1]}=${match[2]}` : undefined;
}

export function parseArmorySection(html: string, name: string, realm: string, section: ArmorySection,
  category = "summary", fragment?: string, summary?: unknown): ArmorySectionData {
  const $ = matchingArmoryDocument(html, name, realm);
  const result: ArmorySectionData = { version: 1, characterName: name, realm, section, category, groups: [], categories: [], specs: [] };
  const group = (title: string, rows: ArmorySectionData["groups"][number]["rows"]) => result.groups.push({ title, rows });
  if (section === "summary") {
    if (!$(".character-stats .value").length) throw new Error("Character stats unavailable");
    if (!summary || typeof summary !== "object") throw new Error("Character summary unavailable");
    const data = summary as Record<string, unknown>;
    if (typeof data.name !== "string" || data.name.toLowerCase() !== name.toLowerCase()
      || typeof data.realm !== "string" || data.realm.toLowerCase() !== realm.toLowerCase()) throw new Error("Summary identity mismatch");
    const fields = [["level", "Level"], ["race", "Race"], ["class", "Class"], ["faction", "Faction"], ["gender", "Gender"],
      ["guild", "Guild"], ["achievementpoints", "Achievement points"], ["honorablekills", "Honorable kills"]];
    group("Character", fields.flatMap(([key, label]) => typeof data[key] === "string" || typeof data[key] === "number"
      ? [{ label, value: clean(String(data[key])) || "None listed" }] : []));
    if (typeof data.online === "boolean") result.groups[0].rows.push({ label: "Status at snapshot", value: data.online ? "Online" : "Offline" });
    $(".character-stats .value").each((_, element) => {
      // Ignore indentation between the label, its <br>, and the value span.
      let previous = $(element).get(0)?.prev;
      let label = "";
      while (previous) {
        if (previous.type === "text" && clean(previous.data)) { label = clean(previous.data); break; }
        previous = previous.prev;
      }
      const lines = ($(element).html() ?? "").split(/<br\s*\/?\s*>/i);
      group(label || "Stats", lines.flatMap(line => {
        const match = clean(document(line).text()).match(/^([^:]+):\s*(.+)$/);
        return match ? [{ label: match[1], value: match[2] }] : [];
      }));
    });
    $(".profskills").each((index, element) => {
      group(index === 0 ? "Professions" : "Secondary skills", $(element).find(".text").toArray().map(node => ({
        label: clean($(node).clone().children().remove().end().text()), value: clean($(node).find(".value").text()),
      })));
    });
    group("Specializations", $(".specialization .text").toArray().map(node => ({
      label: clean($(node).clone().children().remove().end().text()), value: clean($(node).find(".value").text()),
    })));
    group("Player vs player", $(".pvpbasic .text").toArray().map(node => ({
      label: clean($(node).clone().children().remove().end().text()), value: clean($(node).find(".value").text()),
    })));
    group("Recent activity", $(".activity .text, .activity-feed .text, .recent-activity .text").toArray().map(node => ({ label: clean($(node).text()), value: "" })));
  } else if (section === "talents") {
    if (!$(".talent-spec-switch").length) throw new Error("Talents unavailable");
    $(".talents-container").each((_, element) => {
      const index = Number($(element).attr("id")?.match(/^spec-([01])$/)?.[1]);
      const spec: ArmorySectionData["specs"][number] = { index,
        name: clean($(`.talent-spec-switch a[data-spec='${index}']`).text()), trees: [], glyphs: [] };
      $(element).find(".talent-tree").each((_, treeElement) => {
        const info = $(treeElement).find(".talent-tree-info span");
        const tree: typeof spec.trees[number] = { name: clean(info.eq(0).text()), points: Number(clean(info.eq(1).text())), nodes: [] };
        $(treeElement).find(".tier").each((row, tier) => {
          $(tier).find("a.talent").each((_, node) => {
            const ranks = clean($(node).find(".talent-points").text()).match(/^(\d)\/(\d)$/);
            const column = Number($(node).attr("class")?.match(/\bcol([0-3])\b/)?.[1]);
            const rawIcon = $(node).attr("style")?.match(/(?:https?:)?(\/\/cdn\.warmane\.com\/wotlk\/(?:bw)?icons\/(?:small|medium|large)\/[a-z0-9_]+\.jpg)/)?.[1];
            if (!ranks) throw new Error("Talent ranks unavailable");
            const rank = Number(ranks[1]), maxRank = Number(ranks[2]);
            if (rank > maxRank) throw new Error("Invalid talent rank");
            tree.nodes.push({ spellId: spellId($(node).attr("href")), row, column, rank, maxRank,
              ...(rawIcon ? { iconUrl: `https:${rawIcon}` } : {}) });
          });
        });
        if (!tree.name || !tree.nodes.length || tree.nodes.reduce((sum, node) => sum + node.rank, 0) !== tree.points)
          throw new Error("Incomplete talent tree");
        if (new Set(tree.nodes.map(node => `${node.row}:${node.column}`)).size !== tree.nodes.length) throw new Error("Duplicate talent position");
        spec.trees.push(tree);
      });
      $(`[data-glyphs='${index}'] .glyph`).each((_, node) => {
        spec.glyphs.push({ name: clean($(node).text()), kind: $(node).hasClass("major") ? "Major" : "Minor",
          spellId: spellId($(node).find("a").attr("href")) });
      });
      if (!spec.name || spec.trees.reduce((sum, tree) => sum + tree.points, 0) > 71) throw new Error("Invalid talent build");
      result.specs.push(spec);
    });
    const listedSpecs = new Set($(".talent-spec-switch a[data-spec]").toArray().map(node => Number($(node).attr("data-spec"))));
    if (result.specs.length !== listedSpecs.size || new Set(result.specs.map(spec => spec.index)).size !== result.specs.length
      || result.specs.some(spec => !listedSpecs.has(spec.index))) throw new Error("Incomplete talent builds");
  } else if (section === "reputation") {
    if (!$(".reputation").length) throw new Error("Reputation unavailable");
    group("Faction reputation", $(".reputation").toArray().map(node => ({ label: clean($(node).find(".name").text()),
      value: clean($(node).find(".standing").text()), detail: clean($(node).find(".contentbody").text()) })));
  } else if (section === "collections") {
    if (!$("#mount-tab").length || !$("#companion-tab").length) throw new Error("Collections unavailable");
    for (const [selector, title] of [["#mount-tab", "Mounts"], ["#companion-tab", "Companions"]]) {
      group(title, $(`${selector} .basic a`).toArray().map(node => ({ label: clean($(node).text()), value: "Collected",
        ...(safeReference($(node).attr("href")) ? { url: safeReference($(node).attr("href")) } : {}) })));
    }
  } else if (section === "pvp") {
    if (!$("#data-table-history").length) throw new Error("Arena history unavailable");
    group("Arena matches", $("#data-table-history tbody tr").toArray().flatMap(node => {
      const cells = $(node).find("td").toArray().map(cell => clean($(cell).text()));
      return cells[0] ? [{ label: `Match ${cells[0]} · ${cells[1]}`, value: cells[2], detail: `Rating ${cells[3]} · ${cells[4]} · ${cells[5]} · ${cells[6]}` }] : [];
    }));
  } else {
    result.categories = armoryCategories($).filter(value => isArmoryCategory(section, value.id));
    if (!result.categories.some(value => value.id === category)) throw new Error("Unknown category");
    if (!fragment) throw new Error("Category unavailable");
    const f = document(fragment);
    if (section === "statistics") {
      if (!f("#data-table-list").length) throw new Error("Statistics unavailable");
      group("Lifetime statistics", f("#data-table-list tr").toArray().map(node => ({ label: clean(f(node).find("td").eq(0).text()), value: clean(f(node).find("td").eq(1).text()) })));
    } else if (category === "summary") {
      if (!f(".achievement-summary").length) throw new Error("Achievements unavailable");
      group("Achievement progress", [{ label: "Overall", value: clean(f(".achievement-summary > .progress-bar .progress-text").text()) },
        ...f(".summary-progress").toArray().map(node => ({ label: clean(f(node).clone().children().remove().end().text()), value: clean(f(node).find(".progress-text").text()) }))]);
    } else {
      if (!f(".achievement-list").length) throw new Error("Achievement category unavailable");
      group("Achievements", f(".achievement").toArray().map(node => ({ label: clean(f(node).find(".title").text()),
        value: clean(f(node).find(".date").text()) || "Not earned", detail: `${clean(f(node).find(".points").text())} points · ${clean(f(node).find(".description").text())}`,
        url: `https://wotlk.cavernoftime.com/achievement=${f(node).attr("id")?.match(/^ach(\d+)$/)?.[1] ?? "0"}` })));
    }
  }
  return ArmorySectionDataSchema.parse(result);
}

export function parseArmorySpell(html: string, id: number) {
  const $ = document(html);
  const tooltip = $(`#t${id}-generic.tooltip`);
  const name = clean(tooltip.find("b").first().text());
  const description = clean(tooltip.find("span.q").text());
  if (!name || !description) throw new Error("Spell details unavailable");
  return ArmorySpellSchema.parse({ id, name, description });
}
