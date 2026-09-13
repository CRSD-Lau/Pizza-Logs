export type RealmOption = { id: string; name: string; host: string };

/** Keep unknown IDs scoped: a stale link must never silently show every realm. */
export function parseRealmFilter(value: string | string[] | null | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

export function realmFilterWhere(realmId?: string): { realmId?: string } {
  return realmId ? { realmId } : {};
}

export function encounterRealmWhere(realmId?: string): { upload?: { realmId: string } } {
  return realmId ? { upload: { realmId } } : {};
}

export function realmScopeLabel(realms: RealmOption[], realmId?: string): string {
  if (!realmId) return "All realms";
  const realm = realms.find(item => item.id === realmId);
  return realm ? `${realm.name} · ${realm.host}` : "Unavailable realm";
}

export function realmBrowseHref(path: string, realmId?: string): string {
  return realmId ? `${path}?${new URLSearchParams({ realmId })}` : path;
}

export function isRealmBrowsePath(path: string): boolean {
  return ["/raids", "/players", "/bosses", "/leaderboards", "/weekly"].some(
    base => path === base || path.startsWith(`${base}/`),
  );
}
