"use server";

import { cookies } from "next/headers";
import { shouldUseSecureAdminCookie, verifyAdminSecretValue } from "@/lib/admin-auth";

export async function loginAdmin(secret: string): Promise<boolean> {
  if (!verifyAdminSecretValue(secret)) return false;

  const cookieStore = await cookies();
  cookieStore.set("x-admin-secret", secret, {
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecureAdminCookie(),
    path: "/",
  });

  return true;
}
