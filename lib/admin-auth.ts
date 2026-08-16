import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_CONTEXT = "pizza-logs-admin-session-v1";
export const ADMIN_SESSION_COOKIE = "pizza-logs-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function configuredSecret(): string | null {
  const value = process.env.ADMIN_SECRET;
  return value && value.length > 0 ? value : null;
}

export function verifyAdminSecretValue(secret: unknown): boolean {
  const configured = configuredSecret();
  return configured !== null && typeof secret === "string" && safeEqual(secret, configured);
}

function signSessionPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${SESSION_CONTEXT}\0${payload}`, "utf8")
    .digest("hex");
}

export function createAdminSessionToken(nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  const configured = configuredSecret();
  if (configured === null) return null;

  const expiresAt = nowSeconds + ADMIN_SESSION_MAX_AGE_SECONDS;
  const payload = `${expiresAt}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${signSessionPayload(payload, configured)}`;
}

export function verifyAdminSessionToken(
  token: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const configured = configuredSecret();
  if (configured === null || typeof token !== "string") return false;

  const match = /^(\d{1,12})\.([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return false;

  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds) return false;

  const payload = `${match[1]}.${match[2]}`;
  return safeEqual(match[3], signSessionPayload(payload, configured));
}

export function shouldUseSecureAdminCookie(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ADMIN_COOKIE_SECURE !== "false";
}
