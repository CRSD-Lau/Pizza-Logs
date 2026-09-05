import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  ADMIN_AUTH_COOKIE_PREFIX,
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  type AdminAuthConfiguration,
} from "@/lib/admin-auth-config";

export type AdminAuthDatabase = PrismaClient | Prisma.TransactionClient;

// Only the HTTP boundary creates a proof-bearing session, after the library has
// verified a login challenge. Request fields and enabled-user flags are not proof.
export function createAdminAuth(
  database: AdminAuthDatabase,
  configuration: AdminAuthConfiguration,
  verifiedSignIn = false,
) {
  return betterAuth({
    appName: "Pizza Logs",
    baseURL: configuration.baseURL,
    basePath: "/api/auth",
    secret: configuration.secret,
    trustedOrigins: [configuration.baseURL],
    telemetry: { enabled: false },
    logger: { disabled: true },
    database: prismaAdapter(database, { provider: "postgresql", transaction: false }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: ADMIN_PASSWORD_MIN_LENGTH,
      maxPasswordLength: ADMIN_PASSWORD_MAX_LENGTH,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    },
    user: { modelName: "adminAuthUser", changeEmail: { enabled: false }, deleteUser: { enabled: false } },
    account: { modelName: "adminAuthAccount", accountLinking: { enabled: false } },
    verification: { modelName: "adminAuthVerification" },
    session: {
      modelName: "adminAuthSession",
      expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS,
      freshAge: 15 * 60,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
      additionalFields: {
        mfaVerifiedAt: { type: "date", required: false, input: false, returned: false },
        adminRevision: { type: "number", defaultValue: 0, input: false, returned: false },
      },
    },
    advanced: {
      cookiePrefix: ADMIN_AUTH_COOKIE_PREFIX,
      useSecureCookies: configuration.secureCookies,
      defaultCookieAttributes: { httpOnly: true, sameSite: "strict", secure: configuration.secureCookies },
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    // Also bounded account-wide at the HTTP boundary, independently of client IP.
    rateLimit: {
      enabled: true, storage: "database", modelName: "adminAuthRateLimit", window: 60, max: 30,
    },
    plugins: [twoFactor({
      issuer: "Pizza Logs",
      skipVerificationOnEnable: false,
      allowPasswordless: false,
      twoFactorCookieMaxAge: 5 * 60,
      backupCodeOptions: { amount: 10, length: 12, storeBackupCodes: "encrypted" },
      schema: { twoFactor: { modelName: "adminAuthTwoFactor" } },
    })],
    databaseHooks: {
      session: { create: { before: async (session, context) => {
        const identity = await database.adminIdentity.findUnique({ where: { id: 1 } });
        if (!identity || identity.userId !== session.userId) return false;
        const proofPath = context?.path === "/two-factor/verify-totp"
          || context?.path === "/two-factor/verify-backup-code";
        const factor = verifiedSignIn && proofPath
          ? await database.adminAuthTwoFactor.findUnique({ where: { userId: session.userId } })
          : null;
        return { data: {
          ...session,
          // Do not inherit proof when the library rotates an existing session.
          mfaVerifiedAt: factor?.verified ? new Date() : null,
          adminRevision: identity.revision,
          expiresAt: new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1_000),
        } };
      } } },
    },
  });
}

export async function getAdminDatabase(): Promise<PrismaClient> {
  return (await import("@/lib/db")).db;
}

export async function withAdminAuthTransaction<T>(
  database: PrismaClient,
  action: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return database.$transaction(async transaction => {
    // Shared with provisioning and recovery; all work uses this connection.
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(180207, 7501)`;
    return action(transaction);
  }, { maxWait: 5_000, timeout: 15_000 });
}
