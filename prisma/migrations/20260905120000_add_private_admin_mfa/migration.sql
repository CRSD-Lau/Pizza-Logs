-- CreateTable
CREATE TABLE "admin_auth_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_auth_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "mfaVerifiedAt" TIMESTAMP(3),
    "adminRevision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "admin_auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_auth_accounts" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "password" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_auth_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_auth_two_factors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "admin_auth_two_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_auth_rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "admin_auth_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_identity" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_auth_totp_uses" (
    "fingerprint" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_auth_totp_uses_pkey" PRIMARY KEY ("fingerprint")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_auth_users_email_key" ON "admin_auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_auth_sessions_token_key" ON "admin_auth_sessions"("token");

-- CreateIndex
CREATE INDEX "admin_auth_sessions_userId_idx" ON "admin_auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "admin_auth_sessions_expiresAt_idx" ON "admin_auth_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "admin_auth_accounts_userId_idx" ON "admin_auth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_auth_accounts_issuer_accountId_key" ON "admin_auth_accounts"("issuer", "accountId");

-- CreateIndex
CREATE INDEX "admin_auth_verifications_identifier_idx" ON "admin_auth_verifications"("identifier");

-- CreateIndex
CREATE INDEX "admin_auth_verifications_expiresAt_idx" ON "admin_auth_verifications"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_auth_two_factors_userId_key" ON "admin_auth_two_factors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_auth_rate_limits_key_key" ON "admin_auth_rate_limits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "admin_identity_userId_key" ON "admin_identity"("userId");

-- CreateIndex
CREATE INDEX "admin_auth_totp_uses_expiresAt_idx" ON "admin_auth_totp_uses"("expiresAt");

-- AddForeignKey
ALTER TABLE "admin_auth_sessions" ADD CONSTRAINT "admin_auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_auth_accounts" ADD CONSTRAINT "admin_auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_auth_two_factors" ADD CONSTRAINT "admin_auth_two_factors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_identity" ADD CONSTRAINT "admin_identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_identity" ADD CONSTRAINT "admin_identity_singleton_check" CHECK ("id" = 1);
