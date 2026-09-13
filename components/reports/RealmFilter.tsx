import type { ReportSearchParams } from "@/lib/difficulty-filter";
import { realmScopeLabel, type RealmOption } from "@/lib/realm-filter";

export function RealmSelect({ id, realms, realmId }: {
  id: string; realms: RealmOption[]; realmId?: string;
}) {
  return (
    <div className="grid min-w-0 gap-1.5 sm:flex-none">
      <label htmlFor={`${id}-realm`} className="text-sm font-semibold text-text-secondary">Realm</label>
      <select id={`${id}-realm`} name="realmId" defaultValue={realmId ?? ""} className="min-h-11 min-w-0 w-full max-w-full rounded-sm border border-gold-dim bg-bg-card px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-gold">
        <option value="">All realms</option>
        {realmId && !realms.some(realm => realm.id === realmId) && <option value={realmId}>Unavailable realm</option>}
        {realms.map(realm => <option key={realm.id} value={realm.id}>{realm.name} · {realm.host}</option>)}
      </select>
    </div>
  );
}

export function RealmFilter({ action, id, realms, realmId, searchParams }: {
  action: string; id: string; realms: RealmOption[]; realmId?: string; searchParams: ReportSearchParams;
}) {
  return (
    <div className="space-y-3">
      <form action={action} method="get" aria-label="Realm filters" className="flex flex-wrap items-end gap-3">
        {Object.entries(searchParams).filter(([key]) => key !== "realmId" && key !== "page").flatMap(([key, value]) => (
          (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((item, index) => <input key={`${key}-${index}`} type="hidden" name={key} value={item} />)
        ))}
        <RealmSelect id={id} realms={realms} realmId={realmId} />
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-gold px-4 text-sm font-semibold text-gold-light hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-gold">Apply filters</button>
      </form>
      <p className="text-sm text-text-secondary">{realmScopeLabel(realms, realmId)}</p>
    </div>
  );
}
