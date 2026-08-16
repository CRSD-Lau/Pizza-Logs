import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSecretValue,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const header = request.headers.get("x-admin-secret");

  if (verifyAdminSessionToken(cookie) || verifyAdminSecretValue(header)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: "/admin/:path*",
};
