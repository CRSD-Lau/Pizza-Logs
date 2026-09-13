import { db } from "@/lib/db";
import type { RealmOption } from "./realm-filter";

export async function getRealmOptions(): Promise<RealmOption[]> {
  return db.realm.findMany({
    select: { id: true, name: true, host: true },
    orderBy: [{ name: "asc" }, { host: "asc" }, { id: "asc" }],
  });
}
