-- Migration: Verify existing unverified users
-- Description: Mark all existing users with isEmailVerified = false as verified
-- This is a safe data-only migration that preserves all other user data

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

UPDATE "users"
SET
  "isEmailVerified" = true,
  "emailVerifiedAt" = NOW()
WHERE
  "isEmailVerified" = false;
