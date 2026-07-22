-- Migration: Verify existing unverified users
-- Description: Mark all existing users with isEmailVerified = false as verified
-- This is a safe data-only migration that preserves all other user data

UPDATE "users"
SET
  "isEmailVerified" = true,
  "emailVerifiedAt" = NOW()
WHERE
  "isEmailVerified" = false;
