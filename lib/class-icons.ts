const CLASS_ICON_SLUGS: Record<string, string> = {
  deathknight: "classicon_deathknight",
  "death knight": "classicon_deathknight",
  druid: "classicon_druid",
  hunter: "classicon_hunter",
  mage: "classicon_mage",
  paladin: "classicon_paladin",
  priest: "classicon_priest",
  rogue: "classicon_rogue",
  shaman: "classicon_shaman",
  warlock: "classicon_warlock",
  warrior: "classicon_warrior",
};

export function getClassIconUrl(className: string | null | undefined): string | null {
  const key = className?.trim().toLowerCase();
  if (!key) return null;

  const slug = CLASS_ICON_SLUGS[key.replace(/\s+/g, " ")] ?? CLASS_ICON_SLUGS[key.replace(/\s+/g, "")];
  return slug ? `https://wow.zamimg.com/images/wow/icons/large/${slug}.jpg` : null;
}
