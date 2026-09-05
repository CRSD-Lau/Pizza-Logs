import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminEnrollmentSession, getAdminSession } from "@/lib/admin-auth";
import { AuthPanel } from "../AuthPanel";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const requestHeaders = await headers();
  if (await getAdminSession(requestHeaders)) redirect("/admin");
  if (await getAdminEnrollmentSession(requestHeaders)) redirect("/admin/enroll");

  return (
    <AuthPanel title="Admin sign in" description="Use your admin account and authenticator to continue.">
      <LoginForm />
    </AuthPanel>
  );
}
