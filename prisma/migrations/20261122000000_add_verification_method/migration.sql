-- Add VerificationMethod enum and store verification columns.

CREATE TYPE "VerificationMethod" AS ENUM ('NONE', 'KYC', 'ADMIN_FLAG');
ALTER TABLE "stores" ADD COLUMN "verificationMethod" "VerificationMethod" NOT NULL DEFAULT 'NONE';
ALTER TABLE "stores" ADD COLUMN "kycVerifiedAt" TIMESTAMP(3);
ALTER TYPE "VerificationAction" ADD VALUE IF NOT EXISTS 'ADMIN_VERIFIED';

