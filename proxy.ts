import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { ADMIN_AUTH_COOKIE_PREFIX } from "@/lib/admin-auth-config";

export function proxy(request: NextRequest) {
  // This is only an optimistic redirect. Every page/action/API separately checks
  // the live database session, designated identity and completed MFA proof.
  const publicAuthPage = request.nextUrl.pathname === "/admin/login"
    || request.nextUrl.pathname === "/admin/enroll";
  const response = publicAuthPage || getSessionCookie(request, { cookiePrefix: ADMIN_AUTH_COOKIE_PREFIX })
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/admin/login", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: "/admin/:path*",
};
