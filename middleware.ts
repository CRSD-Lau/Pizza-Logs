import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET;

  // No secret configured → allow (local dev without env var)
  if (!secret) return NextResponse.next();

  const cookie = request.cookies.get("x-admin-secret")?.value;
  const header = request.headers.get("x-admin-secret");

  if (cookie === secret || header === secret) {
    return NextResponse.next();
  }

  return new NextResponse(
    `<!doctype html><html><head><title>401 Unauthorized</title></head><body style="font-family:monospace;padding:2rem;background:#0a0a0f;color:#9ca3af"><h1 style="color:#c8a84b">401 — Unauthorized</h1><p>Set the <code>x-admin-secret</code> cookie or header to access this page.</p><a href="/" style="color:#c8a84b">← Home</a></body></html>`,
    { status: 401, headers: { "Content-Type": "text/html" } },
  );
}

export const config = {
  matcher: "/admin/:path*",
};
