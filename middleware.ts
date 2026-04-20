import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Always allow the login page through
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const secret = process.env.ADMIN_SECRET;

  // No secret configured → allow (local dev without env var)
  if (!secret) return NextResponse.next();

  const cookie = request.cookies.get("x-admin-secret")?.value;
  const header = request.headers.get("x-admin-secret");

  if (cookie === secret || header === secret) return NextResponse.next();

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: "/admin/:path*",
};
