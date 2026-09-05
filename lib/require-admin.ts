import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";

/** Check the database-backed MFA session at the data boundary, not only in Proxy. */
export async function requireAdmin() {
  const session = await getAdminSession(await headers());
  if (!session) redirect("/admin/login");
  return session;
}
