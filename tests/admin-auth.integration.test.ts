import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { handleAdminAuth } from "../lib/admin-auth-route";
import { getAdminEnrollmentSession, getAdminSession } from "../lib/admin-auth";
import { getAdminDatabase } from "../lib/auth";
import { provisionAdminAccount, recoverAdminAccount } from "../lib/admin-account-operator";

const baseURL = "http://localhost:53075";
const testKey = "pizza-admin-mfa-isolated-test-key-20260905";
const password = "synthetic-only-password-20260905";
const replacement = "synthetic-replacement-password-20260905";
const email = "admin-auth-fixture@example.invalid";

class Browser {
  cookies = new Map<string, string>();
  constructor(private database: PrismaClient) {}
  headers(): Headers {
    return new Headers({ origin: baseURL, "content-type": "application/json", cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ") });
  }
  async request(path: string, body?: Record<string, unknown>, method = "POST"): Promise<Response> {
    const response = await handleAdminAuth(new Request(`${baseURL}/api/auth${path}`, {
      method, headers: this.headers(), ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    }), this.database);
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      const key = pair.slice(0, separator);
      if (/max-age=0(?:;|$)/i.test(cookie)) this.cookies.delete(key);
      else this.cookies.set(key, pair.slice(separator + 1));
    }
    return response;
  }
}

test("private admin auth enforces enrollment, per-session MFA, replay prevention and operator recovery", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const connection = new URL(process.env.TEST_DATABASE_URL!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(connection.hostname), "auth fixtures only run against a loopback database");
  const schema = `admin_auth_${randomUUID().replaceAll("-", "")}`;
  const settings: Record<string, string | undefined> = {};
  for (const key of ["DATABASE_URL", "ADMIN_SECRET", "ADMIN_AUTH_URL", "NODE_ENV", "ADMIN_COOKIE_SECURE"]) settings[key] = process.env[key];
  connection.searchParams.set("schema", schema);
  process.env.DATABASE_URL = connection.toString();
  process.env.ADMIN_SECRET = testKey;
  process.env.ADMIN_AUTH_URL = baseURL;
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  delete process.env.ADMIN_COOKIE_SECURE;
  const setup = new pg.Client({ connectionString: connection.toString() });
  await setup.connect();
  await setup.query(`CREATE SCHEMA "${schema}"`);
  await setup.query(`SET search_path TO "${schema}"`);
  const migration = await readFile("prisma/migrations/20260905120000_add_private_admin_mfa/migration.sql", "utf8");
  await setup.query(migration);
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 4 }, { schema }) });
  const clearBudgets = () => database.adminAuthRateLimit.deleteMany();
  const totp = async (offset = 0) => {
    const factor = await database.adminAuthTwoFactor.findFirstOrThrow();
    const secret = await symmetricDecrypt({ key: testKey, data: factor.secret });
    return createOTP(secret).hotp(Math.floor(Date.now() / 30_000) + offset);
  };
  try {
    const stranger = new Browser(database);
    assert.equal(await getAdminSession(stranger.headers()), null);
    assert.equal((await stranger.request("/sign-up/email", { email, password, name: "No registration" })).status, 404);
    assert.equal((await stranger.request("/two-factor/disable", { password })).status, 404);
    assert.equal((await stranger.request("/update-user", { email: "other@example.invalid" })).status, 404);
    assert.equal((await stranger.request("/two-factor/verify-totp", { code: "123456", trustDevice: true })).status, 400);
    const badOrigin = await handleAdminAuth(new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST", headers: { origin: "https://untrusted.invalid", "content-type": "application/json" }, body: JSON.stringify({ email, password }),
    }), database);
    assert.equal(badOrigin.status, 403);
    delete process.env.ADMIN_SECRET;
    assert.equal((await stranger.request("/sign-in/email", { email, password })).status, 503);
    assert.equal(await getAdminSession(stranger.headers()), null);
    process.env.ADMIN_SECRET = testKey;
    for (let index = 0; index < 12; index++) {
      assert.equal((await stranger.request("/revoke-sessions")).status, 403);
      assert.equal((await stranger.request("/two-factor/verify-totp", { code: "123456" })).status, 401);
    }
    assert.equal(await database.adminAuthRateLimit.count(), 0, "anonymous requests cannot exhaust protected account budgets");

    const provisioned = await Promise.allSettled([
      provisionAdminAccount(database, { email, password }), provisionAdminAccount(database, { email, password }),
    ]);
    assert.equal(provisioned.filter(result => result.status === "fulfilled").length, 1, "concurrent provisioners cannot create two admins");
    assert.equal(await database.adminAuthUser.count(), 1);
    const identity = await database.adminIdentity.findUniqueOrThrow({ where: { id: 1 } });
    assert.equal((await stranger.request("/sign-in/email", { email, password: "incorrect password" })).status, 401);
    const browser = new Browser(database);
    const login = await browser.request("/sign-in/email", { email, password });
    assert.equal(login.status, 200, await login.clone().text());
    assert.ok(login.headers.getSetCookie().some(cookie => /httponly/i.test(cookie) && /samesite=strict/i.test(cookie)));
    assert.equal(await getAdminSession(browser.headers()), null, "password alone does not authorize administration");
    assert.ok(await getAdminEnrollmentSession(browser.headers()));
    const onboardingHeaders = browser.headers();
    assert.equal((await browser.request("/revoke-sessions")).status, 403);
    const enabled = await browser.request("/two-factor/enable", { password, method: "totp" });
    assert.equal(enabled.status, 200, await enabled.clone().text());
    const enrollment = await enabled.json() as { totpURI: string; backupCodes: string[] };
    assert.ok(enrollment.totpURI.startsWith("otpauth://totp/"));
    assert.equal(enrollment.backupCodes.length, 10);
    const savedFactor = await database.adminAuthTwoFactor.findFirstOrThrow();
    assert.ok(!savedFactor.backupCodes.includes(enrollment.backupCodes[0]), "recovery codes are encrypted at rest");
    assert.equal(savedFactor.verified, false);
    const badCode = await browser.request("/two-factor/verify-totp", { code: "not-a-code" });
    assert.equal(badCode.status, 400);
    const code = await totp();
    const enrollmentVerified = await browser.request("/two-factor/verify-totp", { code });
    assert.equal(enrollmentVerified.status, 200, await enrollmentVerified.clone().text());
    assert.equal((await enrollmentVerified.json() as { enrollmentComplete?: boolean }).enrollmentComplete, true);
    assert.equal(await database.adminAuthSession.count(), 0, "enrollment sessions and library rotation are revoked");
    assert.equal(await getAdminSession(onboardingHeaders), null);
    assert.equal(await getAdminEnrollmentSession(onboardingHeaders), null);
    assert.equal(await getAdminSession(browser.headers()), null);
    await clearBudgets();

    const challenge = await browser.request("/sign-in/email", { email, password });
    assert.equal((await challenge.json() as { twoFactorRedirect?: boolean }).twoFactorRedirect, true);
    assert.equal(await database.adminAuthSession.count(), 0, "a pending MFA challenge has no authenticated session");
    assert.equal(await getAdminSession(browser.headers()), null);
    const challengeHeaders = browser.headers();
    assert.equal((await browser.request("/two-factor/verify-totp", { code })).status, 401, "enrollment TOTP cannot be replayed for login");
    const signInCode = await totp(1);
    const verified = await browser.request("/two-factor/verify-totp", { code: signInCode });
    assert.equal(verified.status, 200, await verified.clone().text());
    const authenticated = await getAdminSession(browser.headers());
    assert.ok(authenticated?.session.mfaVerifiedAt, "successful MFA writes proof onto this exact session");
    assert.equal(authenticated.user.id, identity.userId);
    const storedSession = await database.adminAuthSession.findUniqueOrThrow({ where: { id: authenticated.session.id } });
    assert.ok(storedSession.expiresAt.getTime() - storedSession.createdAt.getTime() <= 8 * 60 * 60 * 1_000 + 1_000);
    await database.adminAuthSession.update({ where: { id: storedSession.id }, data: { mfaVerifiedAt: null } });
    assert.equal(await getAdminSession(browser.headers()), null, "enabled user flag cannot replace session MFA proof");
    await database.adminAuthSession.update({ where: { id: storedSession.id }, data: { mfaVerifiedAt: storedSession.mfaVerifiedAt } });
    const legacy = new Headers({ cookie: "pizza-logs-admin-session=old-token", "x-admin-secret": testKey });
    assert.equal(await getAdminSession(legacy), null);
    const stolenChallenge = await handleAdminAuth(new Request(`${baseURL}/api/auth/two-factor/verify-totp`, {
      method: "POST", headers: challengeHeaders, body: JSON.stringify({ code }),
    }), database);
    assert.equal(stolenChallenge.status, 401, "consumed challenges cannot be replayed");
    await database.adminAuthSession.update({ where: { id: storedSession.id }, data: { expiresAt: new Date(0) } });
    assert.equal(await getAdminSession(browser.headers()), null, "expired session denies immediately");
    // The library may delete the expired row while verifying it; do not revive it.
    await clearBudgets();

    const repeat = new Browser(database);
    await repeat.request("/sign-in/email", { email, password });
    assert.equal((await repeat.request("/two-factor/verify-totp", { code })).status, 401, "a used TOTP cannot authorize a different login challenge");
    await clearBudgets();
    const first = new Browser(database);
    const second = new Browser(database);
    await first.request("/sign-in/email", { email, password });
    await second.request("/sign-in/email", { email, password });
    const recoveryRace = await Promise.all([
      first.request("/two-factor/verify-backup-code", { code: enrollment.backupCodes[0] }),
      second.request("/two-factor/verify-backup-code", { code: enrollment.backupCodes[0] }),
    ]);
    assert.deepEqual(recoveryRace.map(response => response.status).sort(), [200, 401], "one recovery code succeeds once across concurrent challenges");
    const winner = recoveryRace[0].status === 200 ? first : second;
    const winnerSession = await getAdminSession(winner.headers());
    assert.ok(winnerSession);
    const oldProof = winnerSession.session.mfaVerifiedAt!;
    const oldCreated = winnerSession.session.createdAt;
    await database.adminAuthSession.update({ where: { id: winnerSession.session.id }, data: {
      mfaVerifiedAt: new Date(Date.now() - 16 * 60_000), createdAt: new Date(Date.now() - 16 * 60_000),
    } });
    assert.equal((await winner.request("/two-factor/generate-backup-codes", { password })).status, 403, "security maintenance requires recent MFA");
    await database.adminAuthSession.update({ where: { id: winnerSession.session.id }, data: { mfaVerifiedAt: oldProof, createdAt: oldCreated } });
    const rotated = await winner.request("/two-factor/generate-backup-codes", { password });
    assert.equal(rotated.status, 200, await rotated.clone().text());
    const rotatedCodes = (await rotated.json() as { backupCodes: string[] }).backupCodes;
    assert.equal(rotatedCodes.length, 10);
    assert.ok(!rotatedCodes.some(value => enrollment.backupCodes.includes(value)));
    const beforeChange = winner.headers();
    const changed = await winner.request("/change-password", { currentPassword: password, newPassword: replacement, revokeOtherSessions: false });
    assert.equal(changed.status, 200, await changed.clone().text());
    assert.equal(await getAdminSession(beforeChange), null, "password change revokes every session including the current one");
    assert.equal(await database.adminAuthSession.count(), 0);
    await clearBudgets();
    const afterChange = new Browser(database);
    assert.equal((await afterChange.request("/sign-in/email", { email, password })).status, 401);
    await afterChange.request("/sign-in/email", { email, password: replacement });
    assert.equal((await afterChange.request("/two-factor/verify-backup-code", { code: enrollment.backupCodes[1] })).status, 401, "rotated recovery codes cannot be used");
    assert.equal((await afterChange.request("/two-factor/verify-backup-code", { code: rotatedCodes[0] })).status, 200);
    const beforeLogout = afterChange.headers();
    assert.equal((await afterChange.request("/sign-out")).status, 200);
    assert.equal(await getAdminSession(beforeLogout), null, "logout revokes the stored session");
    await clearBudgets();
    await afterChange.request("/sign-in/email", { email, password: replacement });
    await afterChange.request("/two-factor/verify-backup-code", { code: rotatedCodes[1] });
    const beforeRevocation = afterChange.headers();
    assert.equal((await afterChange.request("/revoke-sessions")).status, 200);
    assert.equal(await getAdminSession(beforeRevocation), null, "revocation has no cookie-cache grace period");

    await clearBudgets();
    const expiredChallenge = new Browser(database);
    await expiredChallenge.request("/sign-in/email", { email, password: replacement });
    await database.adminAuthVerification.updateMany({
      where: { identifier: { startsWith: "2fa-" } }, data: { expiresAt: new Date(0) },
    });
    assert.equal((await expiredChallenge.request("/two-factor/verify-backup-code", { code: rotatedCodes[2] })).status, 401,
      "an expired password challenge cannot create a proof-bearing MFA session");

    await clearBudgets();
    const pending = new Browser(database);
    await pending.request("/sign-in/email", { email, password: replacement });
    const recovered = await recoverAdminAccount(database, { email, password });
    assert.equal(recovered.userId, identity.userId, "operator recovery preserves the immutable authorization identity");
    assert.equal(await database.adminAuthUser.count(), 1);
    assert.equal(await database.adminAuthSession.count(), 0);
    assert.equal(await database.adminAuthTwoFactor.count(), 0);
    assert.equal(await database.adminAuthVerification.count(), 0);
    assert.equal((await pending.request("/two-factor/verify-backup-code", { code: rotatedCodes[2] })).status, 401, "operator recovery invalidates outstanding challenges");
    const recoveredBrowser = new Browser(database);
    await recoveredBrowser.request("/sign-in/email", { email, password });
    assert.ok(await getAdminEnrollmentSession(recoveredBrowser.headers()));
    assert.equal(await getAdminSession(recoveredBrowser.headers()), null, "operator recovery never bypasses new MFA enrollment");

    await clearBudgets();
    for (let index = 0; index < 5; index++) {
      const attempt = await stranger.request("/sign-in/email", { email, password: `incorrect-${index}` });
      assert.ok(attempt.status === 401 || attempt.status === 429, "library or global quota can reject excessive attempts earlier");
    }
    const budget = await database.adminAuthRateLimit.findUniqueOrThrow({ where: { key: "pizza-admin-global:password" } });
    assert.equal(budget.count, 5);
    const throttled = await handleAdminAuth(new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST", headers: { origin: baseURL, "content-type": "application/json", "x-forwarded-for": "203.0.113.200" }, body: JSON.stringify({ email, password }),
    }), database);
    assert.equal(throttled.status, 429, "persistent account-wide throttling survives new auth instances and spoofed IP headers");
  } finally {
    await database.$disconnect();
    await (await getAdminDatabase()).$disconnect();
    await setup.query("SET search_path TO public");
    await setup.query(`DROP SCHEMA "${schema}" CASCADE`);
    await setup.end();
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
