"use server";

import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  shouldUseSecureAdminCookie,
  verifyAdminSecretValue,
} from "@/lib/admin-auth";

export async function loginAdmin(secret: string): Promise<boolean> {
  if (!verifyAdminSecretValue(secret)) return false;
  const sessionToken = createAdminSessionToken();
  if (!sessionToken) return false;

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecureAdminCookie(),
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });

  return true;
}
