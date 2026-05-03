import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecretValue } from "@/lib/admin-auth";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const cookie = request.cookies.get("x-admin-secret")?.value;
  const header = request.headers.get("x-admin-secret");

  if (verifyAdminSecretValue(cookie) || verifyAdminSecretValue(header)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: "/admin/:path*",
};
