-- Owner notifications are queued in the same transaction as a completed upload.
-- Delivery is handled by a separate short-lived worker so email or Railway API
-- failures cannot roll back or delay the public upload response.
CREATE TYPE "NotificationKind" AS ENUM ('UPLOAD_COMPLETED', 'DAILY_DIGEST');
CREATE TYPE "NotificationState" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "notification_jobs" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "renderedEmail" JSONB,
    "state" "NotificationState" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseExpiresAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "lastErrorCode" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_jobs_dedupeKey_key" ON "notification_jobs"("dedupeKey");
CREATE INDEX "notification_jobs_state_availableAt_idx" ON "notification_jobs"("state", "availableAt");
