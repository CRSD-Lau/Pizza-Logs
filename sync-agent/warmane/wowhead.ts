const TIMEOUT_MS = 8_000;

export type WowheadItemData = {
  itemLevel?: number;
  iconUrl?: string;
};

export async function fetchWowheadItem(
  itemId: string
): Promise<WowheadItemData> {
  const url = `https://www.wowhead.com/wotlk/tooltip/item/${itemId}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, unknown>;
    const iconName =
      typeof data.icon === "string" ? data.icon : null;
    return {
      itemLevel:
        typeof data.itemLevel === "number" ? data.itemLevel : undefined,
      iconUrl: iconName
        ? `https://wow.zamimg.com/images/wow/icons/large/${iconName}.jpg`
        : undefined,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}
