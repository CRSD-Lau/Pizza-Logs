import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { getAdminDatabase, withAdminAuthTransaction } from "@/lib/auth";
import {
  ADMIN_PASSWORD_MAX_LENGTH, ADMIN_PASSWORD_MIN_LENGTH, getAdminAuthConfiguration,
} from "@/lib/admin-auth-config";

export interface AdminAccountInput { email: string; password: string; name?: string }

function validateInput(input: AdminAccountInput): { email: string; name: string } {
  if (!getAdminAuthConfiguration()) throw new Error("Configure ADMIN_AUTH_URL and an ADMIN_SECRET of at least 32 characters first.");
  const email = input.email.trim().toLowerCase();
  if (!z.email().safeParse(email).success || email.length > 254) throw new Error("Enter a valid administrator email address.");
  if (input.password.length < ADMIN_PASSWORD_MIN_LENGTH || input.password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    throw new Error(`The password must contain ${ADMIN_PASSWORD_MIN_LENGTH}–${ADMIN_PASSWORD_MAX_LENGTH} characters.`);
  }
  const name = input.name?.trim() || "Administrator";
  if (name.length > 100) throw new Error("Administrator name must be at most 100 characters.");
  return { email, name };
}

// These functions are operator-only. They are never imported by an HTTP handler,
// server action or client. The unique singleton plus shared transaction lock
// prevents racing commands from provisioning two administrators.
export async function provisionAdminAccount(database: PrismaClient, input: AdminAccountInput): Promise<{ userId: string }> {
  const { email, name } = validateInput(input);
  const password = await hashPassword(input.password);
  return withAdminAuthTransaction(database, async transaction => {
    if (await transaction.adminIdentity.findUnique({ where: { id: 1 } })) {
      throw new Error("An administrator is already provisioned. Use the recovery command for that identity.");
    }
    if (await transaction.adminAuthUser.count() !== 0) {
      throw new Error("Unassigned authentication records exist; inspect them before provisioning.");
    }
    const userId = randomUUID();
    await transaction.adminAuthUser.create({ data: {
      id: userId, email, name, emailVerified: true, twoFactorEnabled: false,
      accounts: { create: {
        id: randomUUID(), issuer: "local:credential", providerId: "credential", accountId: userId, password,
      } },
      administrator: { create: { id: 1, revision: 1 } },
    } });
    return { userId };
  });
}

export async function recoverAdminAccount(database: PrismaClient, input: AdminAccountInput): Promise<{ userId: string }> {
  const { email } = validateInput(input);
  const password = await hashPassword(input.password);
  return withAdminAuthTransaction(database, async transaction => {
    const identity = await transaction.adminIdentity.findUnique({ where: { id: 1 }, include: { user: true } });
    if (!identity || identity.user.email !== email) throw new Error("The email must match the provisioned administrator.");
    const changed = await transaction.adminAuthAccount.updateMany({
      where: { userId: identity.userId, accountId: identity.userId, issuer: "local:credential", providerId: "credential" },
      data: { password },
    });
    if (changed.count !== 1) throw new Error("The administrator credential record needs operator inspection.");
    await transaction.adminIdentity.update({ where: { id: 1 }, data: { revision: { increment: 1 } } });
    await transaction.adminAuthUser.update({ where: { id: identity.userId }, data: { twoFactorEnabled: false } });
    await transaction.adminAuthSession.deleteMany({ where: { userId: identity.userId } });
    await transaction.adminAuthTwoFactor.deleteMany({ where: { userId: identity.userId } });
    // All verification/rate records belong to this private single-admin system.
    await transaction.adminAuthVerification.deleteMany();
    await transaction.adminAuthTotpUse.deleteMany();
    await transaction.adminAuthRateLimit.deleteMany();
    return { userId: identity.userId };
  });
}

export async function operatorProvision(input: AdminAccountInput): Promise<{ userId: string }> {
  return provisionAdminAccount(await getAdminDatabase(), input);
}

export async function operatorRecover(input: AdminAccountInput): Promise<{ userId: string }> {
  return recoverAdminAccount(await getAdminDatabase(), input);
}
