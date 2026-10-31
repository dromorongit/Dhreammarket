-- CreateEnum (none, using text checks)

-- CreateTable
CREATE TABLE IF NOT EXISTS "waitlist_signups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "interest" TEXT NOT NULL,
    "device" TEXT,
    "consent" BOOLEAN NOT NULL,
    "source" VARCHAR(64),
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "notified_at" TIMESTAMPTZ,

    CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "waitlist_signups_interest_check" CHECK ("interest" IN ('shopping', 'selling', 'both')),
    CONSTRAINT "waitlist_signups_device_check" CHECK ("device" IS NULL OR "device" IN ('android', 'ios', 'both', 'unknown'))
);

-- Unique index on lower(email)
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_signups_email_lower_key" ON "waitlist_signups" (LOWER("email"));

-- Index on created_at DESC
CREATE INDEX IF NOT EXISTS "waitlist_signups_created_at_idx" ON "waitlist_signups" ("created_at" DESC);

-- Index on interest
CREATE INDEX IF NOT EXISTS "waitlist_signups_interest_idx" ON "waitlist_signups" ("interest");

-- Enable RLS (no public policies => no public access; service role/owner bypasses)
ALTER TABLE "waitlist_signups" ENABLE ROW LEVEL SECURITY;
