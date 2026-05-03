export function verifyAdminSecretValue(secret: unknown): boolean {
  const configured = process.env.ADMIN_SECRET;
  if (!configured) return process.env.NODE_ENV !== "production";
  return typeof secret === "string" && secret === configured;
}

export function shouldUseSecureAdminCookie(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ADMIN_COOKIE_SECURE !== "false";
}
