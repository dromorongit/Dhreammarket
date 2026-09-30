-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AppPlatform" AS ENUM ('ANDROID', 'IOS', 'BOTH');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "WaitlistRole" AS ENUM ('CUSTOMER', 'VENDOR');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "app_waitlist_entries" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "platform" "AppPlatform" NOT NULL DEFAULT 'BOTH',
    "role" "WaitlistRole" NOT NULL DEFAULT 'CUSTOMER',
    "source" VARCHAR(64),
    "referredByCode" VARCHAR(32),
    "confirmationSentAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "app_waitlist_entries_email_key" ON "app_waitlist_entries"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "app_waitlist_entries_createdAt_idx" ON "app_waitlist_entries"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "app_waitlist_entries_platform_idx" ON "app_waitlist_entries"("platform");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "app_waitlist_entries_role_idx" ON "app_waitlist_entries"("role");
