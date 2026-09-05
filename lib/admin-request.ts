/** Cookie-authenticated API mutations require an explicit same-origin request. */
export function hasTrustedAdminOrigin(requestHeaders: Headers): boolean {
  const configured = process.env.ADMIN_AUTH_URL;
  const origin = requestHeaders.get("origin");
  if (!configured || !origin || origin === "null") return false;
  try {
    return origin === new URL(configured).origin;
  } catch {
    return false;
  }
}
