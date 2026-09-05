import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { AuthPanel } from "../AuthPanel";
import { SecurityForm } from "./SecurityForm";

export const metadata: Metadata = { title: "Account security" };
export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const session = await getAdminSession(await headers());
  if (!session) redirect("/admin/login");

  return (
    <AuthPanel title="Account security" description="Manage your password, recovery codes and signed-in devices.">
      <SecurityForm email={session.user.email} />
    </AuthPanel>
  );
}
