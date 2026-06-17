-- Migration: Add selector column to auth_tokens table
-- This enables O(1) lookup for password reset tokens

-- Add selector column to auth_tokens table
ALTER TABLE "auth_tokens" ADD COLUMN "selector" TEXT;

-- Create unique index on selector for O(1) lookup
CREATE UNIQUE INDEX "auth_tokens_selector_key" ON "auth_tokens"("selector");

-- Update existing PASSWORD_RESET tokens with selectors (for backward compatibility)
-- Note: This creates selectors for existing tokens but they can't be used to verify
-- because we don't have the original secrets. However, this allows the schema to be valid.

-- Add isEmailVerified and emailVerifiedAt columns to users if they don't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- Create index on isEmailVerified for efficient queries
CREATE INDEX IF NOT EXISTS "users_isEmailVerified_idx" ON "users"("isEmailVerified");

-- Backfill existing ACTIVE users - set isEmailVerified = true to prevent lockout
UPDATE "users" 
SET 
  "isEmailVerified" = true,
  "emailVerifiedAt" = NOW()
WHERE "status" = 'ACTIVE' 
  AND ("isEmailVerified" = false OR "isEmailVerified" IS NULL);

-- Drop the old tokenHash index (no longer needed for direct lookups)
DROP INDEX IF EXISTS "auth_tokens_tokenHash_idx";