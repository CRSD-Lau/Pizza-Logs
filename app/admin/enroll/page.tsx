import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminEnrollmentSession, getAdminSession } from "@/lib/admin-auth";
import { AuthPanel } from "../AuthPanel";
import { EnrollmentForm } from "./EnrollmentForm";

export const metadata: Metadata = { title: "Set up your authenticator" };
export const dynamic = "force-dynamic";

export default async function AdminEnrollmentPage() {
  const requestHeaders = await headers();
  if (await getAdminSession(requestHeaders)) redirect("/admin");
  const enrollment = await getAdminEnrollmentSession(requestHeaders);
  if (!enrollment) redirect("/admin/login");

  return (
    <AuthPanel title="Set up your authenticator" description="Protect your admin account with a code from your authenticator app.">
      <EnrollmentForm email={enrollment.user.email} />
    </AuthPanel>
  );
}
