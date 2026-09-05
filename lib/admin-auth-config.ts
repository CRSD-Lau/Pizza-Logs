export const ADMIN_AUTH_COOKIE_PREFIX = "pizza-logs-auth";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const ADMIN_ENROLLMENT_MAX_AGE_SECONDS = 15 * 60;
export const ADMIN_FRESH_MFA_SECONDS = 15 * 60;
export const ADMIN_PASSWORD_MIN_LENGTH = 14;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

export interface AdminAuthConfiguration {
  secret: string;
  baseURL: string;
  secureCookies: boolean;
}

export function getAdminAuthConfiguration(): AdminAuthConfiguration | null {
  const secret = process.env.ADMIN_SECRET;
  const configuredURL = process.env.ADMIN_AUTH_URL;
  if (!secret || secret.length < 32 || !configuredURL) return null;
  try {
    const url = new URL(configuredURL);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const localTestHTTP = loopback && (
      process.env.NODE_ENV !== "production" || process.env.ADMIN_COOKIE_SECURE === "false"
    );
    if (url.protocol !== "https:" && !(url.protocol === "http:" && localTestHTTP)) return null;
    // A production HTTPS deployment can never disable Secure cookies.
    return { secret, baseURL: url.origin, secureCookies: url.protocol === "https:" };
  } catch {
    return null;
  }
}
