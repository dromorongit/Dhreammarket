-- Repair Migration: add_verification_payment_fields
-- PostgreSQL 18 compatible, idempotent, zero data loss

-- Step 1: Add missing VerificationStatus enum values
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'PAID_PENDING_KYC';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';

-- Step 2: Update vendor_verification_applications status values
UPDATE vendor_verification_applications 
SET status = 'UNPAID'::"VerificationStatus"
WHERE status = 'PAYMENT_PENDING'::"VerificationStatus";

UPDATE vendor_verification_applications 
SET status = 'PAID_PENDING_KYC'::"VerificationStatus" 
WHERE status = 'PAYMENT_COMPLETED'::"VerificationStatus";

UPDATE vendor_verification_applications 
SET status = 'PENDING_REVIEW'::"VerificationStatus"
WHERE status = 'KYC_SUBMITTED'::"VerificationStatus";

UPDATE vendor_verification_applications 
SET status = 'PENDING_REVIEW'::"VerificationStatus"  
WHERE status = 'UNDER_REVIEW'::"VerificationStatus";

UPDATE vendor_verification_applications 
SET status = 'REJECTED'::"VerificationStatus"
WHERE status = 'REVOKED'::"VerificationStatus";

-- Step 3: Update verification_audit_logs actions
UPDATE verification_audit_logs 
SET action = 'ADMIN_REJECTED'::"VerificationAction"
WHERE action = 'ADMIN_REVOKED'::"VerificationAction";

-- Step 4: Add missing columns to vendor_verification_applications (paystackRef already partially added)
ALTER TABLE "vendor_verification_applications" 
ADD COLUMN IF NOT EXISTS paystackRef VARCHAR(255);

-- Step 5: Add missing columns to vendor_verification_kyc
ALTER TABLE "vendor_verification_kyc"
ADD COLUMN IF NOT EXISTS businessAddress TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS nationalIdType VARCHAR(50),
ADD COLUMN IF NOT EXISTS nationalIdNumber VARCHAR(100);

-- Step 5b: Rename columns to proper case if they were created lowercase
ALTER TABLE "vendor_verification_kyc" 
RENAME COLUMN IF EXISTS businessaddress TO "businessAddress",
RENAME COLUMN IF EXISTS nationalidtype TO "nationalIdType",
RENAME COLUMN IF EXISTS nationalidnumber TO "nationalIdNumber";

ALTER TABLE "vendor_verification_applications" 
RENAME COLUMN IF EXISTS paystackref TO "paystackRef";

ALTER TABLE "verification_payments"
RENAME COLUMN IF EXISTS applicationid TO "applicationId",
RENAME COLUMN IF EXISTS paystackref TO "paystackRef",
RENAME COLUMN IF EXISTS createdat TO "createdAt",
RENAME COLUMN IF EXISTS updatedat TO "updatedAt",
RENAME COLUMN IF EXISTS completedat TO "completedAt";

-- Step 6: Create verification_payments table (matches schema.prisma exactly)
CREATE TABLE IF NOT EXISTS verification_payments (
    id TEXT PRIMARY KEY,
    applicationId TEXT NOT NULL UNIQUE,
    reference VARCHAR(255) UNIQUE NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency VARCHAR(10) DEFAULT 'GHS',
    status VARCHAR(50) DEFAULT 'UNPAID',
    paystackRef VARCHAR(255),
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP(3),
    CONSTRAINT verification_payments_application_fkey FOREIGN KEY (applicationId) REFERENCES vendor_verification_applications(id) ON DELETE CASCADE
);