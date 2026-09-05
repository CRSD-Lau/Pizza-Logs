import { createAdminAuth, getAdminDatabase, type AdminAuthDatabase } from "@/lib/auth";
import {
  ADMIN_ENROLLMENT_MAX_AGE_SECONDS, ADMIN_FRESH_MFA_SECONDS,
  getAdminAuthConfiguration, type AdminAuthConfiguration,
} from "@/lib/admin-auth-config";

export { ADMIN_AUTH_COOKIE_PREFIX, ADMIN_SESSION_MAX_AGE_SECONDS } from "@/lib/admin-auth-config";

export interface AdminSession {
  user: { id: string; name: string; email: string; twoFactorEnabled: boolean };
  session: {
    id: string; userId: string; createdAt: Date; expiresAt: Date; mfaVerifiedAt: Date | null;
  };
}

export async function readDesignatedAdminSession(
  database: AdminAuthDatabase, configuration: AdminAuthConfiguration, headers: Headers,
): Promise<AdminSession | null> {
  const authenticated = await createAdminAuth(database, configuration).api.getSession({
    headers, query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!authenticated) return null;
  const identity = await database.adminIdentity.findUnique({ where: { id: 1 } });
  if (!identity || authenticated.user.id !== identity.userId) return null;
  const session = await database.adminAuthSession.findUnique({ where: { id: authenticated.session.id } });
  if (!session || session.userId !== identity.userId || session.adminRevision !== identity.revision
    || session.expiresAt.getTime() <= Date.now()) return null;
  return {
    user: {
      id: authenticated.user.id, name: authenticated.user.name, email: authenticated.user.email,
      twoFactorEnabled: authenticated.user.twoFactorEnabled === true,
    },
    session: {
      id: session.id, userId: session.userId, createdAt: session.createdAt,
      expiresAt: session.expiresAt, mfaVerifiedAt: session.mfaVerifiedAt,
    },
  };
}

export function isFullAdminSession(session: AdminSession | null): session is AdminSession {
  return session !== null && session.user.twoFactorEnabled && session.session.mfaVerifiedAt !== null
    && session.session.mfaVerifiedAt.getTime() <= Date.now()
    && session.session.mfaVerifiedAt.getTime() >= session.session.createdAt.getTime() - 1_000;
}

export function isEnrollmentSession(session: AdminSession | null): session is AdminSession {
  return session !== null && !session.user.twoFactorEnabled && session.session.mfaVerifiedAt === null
    && Date.now() - session.session.createdAt.getTime() <= ADMIN_ENROLLMENT_MAX_AGE_SECONDS * 1_000;
}

export function hasFreshAdminMfa(session: AdminSession): boolean {
  return isFullAdminSession(session)
    && Date.now() - session.session.mfaVerifiedAt!.getTime() <= ADMIN_FRESH_MFA_SECONDS * 1_000;
}

async function getSession(headers: Headers, enrollment: boolean): Promise<AdminSession | null> {
  const configuration = getAdminAuthConfiguration();
  if (!configuration) return null;
  try {
    const session = await readDesignatedAdminSession(await getAdminDatabase(), configuration, headers);
    return (enrollment ? isEnrollmentSession(session) : isFullAdminSession(session)) ? session : null;
  } catch {
    return null;
  }
}

export const getAdminSession = (headers: Headers): Promise<AdminSession | null> => getSession(headers, false);
export const getAdminEnrollmentSession = (headers: Headers): Promise<AdminSession | null> => getSession(headers, true);
