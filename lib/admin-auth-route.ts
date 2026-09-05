import { createHmac } from "node:crypto";
import { createInternalContext } from "better-call";
import type { PrismaClient } from "@/generated/prisma/client";
import { createAdminAuth, getAdminDatabase, withAdminAuthTransaction, type AdminAuthDatabase } from "@/lib/auth";
import {
  hasFreshAdminMfa, isEnrollmentSession, isFullAdminSession, readDesignatedAdminSession,
} from "@/lib/admin-auth";
import { ADMIN_AUTH_COOKIE_PREFIX, getAdminAuthConfiguration, type AdminAuthConfiguration } from "@/lib/admin-auth-config";

const publicPosts = new Set(["/sign-in/email", "/sign-out", "/two-factor/verify-totp", "/two-factor/verify-backup-code"]);
const enrollmentPosts = new Set(["/two-factor/enable", "/two-factor/get-totp-uri"]);
const maintenancePosts = new Set([
  "/change-password", "/two-factor/generate-backup-codes", "/revoke-session", "/revoke-sessions", "/revoke-other-sessions",
]);
const freshPosts = new Set(["/change-password", "/two-factor/generate-backup-codes"]);
const gets = new Set(["/get-session", "/list-sessions"]);

function failure(status: number, code: string, message: string): Response {
  return Response.json({ code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function clearCookies(response: Response, configuration: AdminAuthConfiguration): void {
  const prefix = `${configuration.secureCookies ? "__Secure-" : ""}${ADMIN_AUTH_COOKIE_PREFIX}`;
  for (const name of ["session_token", "session_data", "dont_remember", "two_factor", "trust_device"]) {
    response.headers.append("Set-Cookie", `${prefix}.${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${configuration.secureCookies ? "; Secure" : ""}`);
  }
}

async function consumeAccountBudget(database: AdminAuthDatabase, path: string): Promise<boolean> {
  const category = path === "/sign-in/email" ? "password"
    : path.startsWith("/two-factor/verify-") ? "factor" : "maintenance";
  const maximum = category === "password" ? 5 : 10;
  const key = `pizza-admin-global:${category}`;
  const now = BigInt(Date.now());
  const previous = await database.adminAuthRateLimit.findUnique({ where: { key } });
  if (previous && now - previous.lastRequest < BigInt(60_000)) {
    if (previous.count >= maximum) return false;
    await database.adminAuthRateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  } else {
    await database.adminAuthRateLimit.upsert({ where: { key },
      create: { id: key, key, count: 1, lastRequest: now },
      update: { count: 1, lastRequest: now },
    });
  }
  return true;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (request.body === null) return {};
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) return null;
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 16_384) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    return body !== null && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function handleAdminAuth(request: Request, suppliedDatabase?: PrismaClient): Promise<Response> {
  const configuration = getAdminAuthConfiguration();
  if (!configuration) return failure(503, "AUTH_UNAVAILABLE", "Administrator sign-in is unavailable.");
  const url = new URL(request.url);
  const path = url.pathname.startsWith("/api/auth/") ? url.pathname.slice("/api/auth".length) : "";
  const isPost = request.method === "POST";
  if (!(isPost ? publicPosts.has(path) || enrollmentPosts.has(path) || maintenancePosts.has(path)
    : request.method === "GET" && gets.has(path))) return failure(404, "NOT_FOUND", "Not found.");
  // Credential login also requires an exact Origin; no referer/header fallback.
  if (isPost && request.headers.get("origin") !== configuration.baseURL) {
    return failure(403, "INVALID_ORIGIN", "This request must come from Pizza Logs.");
  }
  const body = isPost ? await readBody(request) : null;
  if (isPost && body === null) return failure(400, "INVALID_REQUEST", "Invalid authentication request.");
  if (body) {
    // These optional library paths would weaken the mandatory MFA/session policy.
    if (body.trustDevice === true || body.disableSession === true || (body.method && body.method !== "totp")) {
      return failure(400, "INVALID_REQUEST", "That authentication option is unavailable.");
    }
    body.trustDevice = false;
    if (path === "/change-password") body.revokeOtherSessions = true;
    if (path === "/sign-in/email") body.rememberMe = true;
  }
  try {
    const database = suppliedDatabase ?? await getAdminDatabase();
    return await withAdminAuthTransaction(database, async transaction => {
      const now = new Date();
      await transaction.adminAuthVerification.deleteMany({ where: { expiresAt: { lt: now } } });
      await transaction.adminAuthTotpUse.deleteMany({ where: { expiresAt: { lt: now } } });
      await transaction.adminAuthRateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(Date.now() - 86_400_000) } } });
      const current = await readDesignatedAdminSession(transaction, configuration, request.headers);
      if (enrollmentPosts.has(path) && !isEnrollmentSession(current)) {
        return failure(403, "ENROLLMENT_REQUIRED", "Sign in to set up your authenticator.");
      }
      if ((maintenancePosts.has(path) || path === "/list-sessions") && !isFullAdminSession(current)) {
        return failure(403, "MFA_REQUIRED", "Complete administrator sign-in first.");
      }
      if (freshPosts.has(path) && current && !hasFreshAdminMfa(current)) {
        return failure(403, "FRESH_MFA_REQUIRED", "Sign out and sign in again before changing security settings.");
      }
      if (path === "/get-session" && !isFullAdminSession(current) && !isEnrollmentSession(current)) {
        return Response.json(null, { headers: { "Cache-Control": "no-store" } });
      }
      const verifiesFactor = path === "/two-factor/verify-totp" || path === "/two-factor/verify-backup-code";
      const enrollment = path === "/two-factor/verify-totp" && isEnrollmentSession(current);
      if (verifiesFactor && current && !enrollment) {
        return failure(403, "FRESH_LOGIN_REQUIRED", "Start a new sign-in before verifying another factor.");
      }
      const auth = createAdminAuth(transaction, configuration, verifiesFactor && !current);
      if (verifiesFactor && !enrollment) {
        const authContext = await auth.$context;
        const cookieContext = await createInternalContext({ headers: request.headers }, { options: { method: "GET" } });
        const challengeId = await cookieContext.getSignedCookie(authContext.createAuthCookie("two_factor").name, configuration.secret);
        const identity = await transaction.adminIdentity.findUnique({ where: { id: 1 }, include: { user: true } });
        const pending = typeof challengeId === "string" && challengeId.startsWith("2fa-")
          ? await transaction.adminAuthVerification.findFirst({ where: { identifier: challengeId } }) : null;
        if (!pending || pending.expiresAt.getTime() <= Date.now() || !identity?.user.twoFactorEnabled
          || pending.value !== identity.userId) {
          return failure(401, "INVALID_TWO_FACTOR_COOKIE", "Start a new sign-in before entering your code.");
        }
      }
      // Anonymous callers cannot exhaust factor or maintenance budgets; those
      // budgets are charged only after proving a password challenge/session.
      if (isPost && path !== "/sign-out" && !await consumeAccountBudget(transaction, path)) {
        const limited = failure(429, "TOO_MANY_REQUESTS", "Too many attempts. Wait one minute and try again.");
        limited.headers.set("Retry-After", "60");
        return limited;
      }
      let fingerprint: string | null = null;
      if (path === "/two-factor/verify-totp") {
        if (typeof body?.code !== "string" || !/^\d{6}$/.test(body.code)) {
          return failure(400, "INVALID_CODE", "Enter a six-digit authenticator code.");
        }
        fingerprint = createHmac("sha256", configuration.secret).update(`pizza-admin-totp-use\0${body.code}`).digest("hex");
        if (await transaction.adminAuthTotpUse.findUnique({ where: { fingerprint } })) {
          return failure(401, "CODE_ALREADY_USED", "That code was already used. Wait for the next authenticator code.");
        }
      }
      // No full session exists during a login challenge. The library creates one
      // only after successful TOTP/recovery verification and challenge consumption.
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      const forwarded = new Request(request.url, {
        method: request.method, headers, ...(isPost ? { body: JSON.stringify(body) } : {}),
      });
      const response = await auth.handler(forwarded);
      if (response.status >= 500) throw new Error("Authentication operation did not complete.");
      response.headers.set("Cache-Control", "no-store");
      if (response.ok && fingerprint) {
        await transaction.adminAuthTotpUse.create({ data: { fingerprint, expiresAt: new Date(Date.now() + 120_000) } });
      }
      if (response.ok && (enrollment || path === "/change-password")) {
        const identity = await transaction.adminIdentity.findUniqueOrThrow({ where: { id: 1 } });
        await transaction.adminIdentity.update({ where: { id: 1 }, data: { revision: { increment: 1 } } });
        await transaction.adminAuthSession.deleteMany({ where: { userId: identity.userId } });
        await transaction.adminAuthVerification.deleteMany();
        const completed = Response.json({ status: true, ...(enrollment ? { enrollmentComplete: true } : {}) }, {
          headers: { "Cache-Control": "no-store" },
        });
        clearCookies(completed, configuration);
        return completed;
      }
      return response;
    });
  } catch {
    return failure(503, "AUTH_UNAVAILABLE", "Administrator sign-in is temporarily unavailable.");
  }
}
