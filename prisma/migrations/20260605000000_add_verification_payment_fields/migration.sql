-- Step 1: Update all VerificationStatus data to use values that exist in the new schema
-- These mappings ensure data compatibility:
-- PAYMENT_PENDING -> UNPAID (both now valid in schema)
-- PAYMENT_COMPLETED -> PAID_PENDING_KYC (both now valid in schema)
-- KYC_SUBMITTED -> PENDING_REVIEW (KYC_SUBMITTED being removed from VerificationStatus, PENDING_REVIEW exists)
-- UNDER_REVIEW -> PENDING_REVIEW (UNDER_REVIEW being removed, PENDING_REVIEW exists)
-- REVOKED -> REJECTED (REVOKED being removed, REJECTED exists)

UPDATE vendor_verification_applications 
SET status = 'UNPAID' 
WHERE status = 'PAYMENT_PENDING';

UPDATE vendor_verification_applications 
SET status = 'PAID_PENDING_KYC' 
WHERE status = 'PAYMENT_COMPLETED';

UPDATE vendor_verification_applications 
SET status = 'PENDING_REVIEW' 
WHERE status = 'KYC_SUBMITTED';

UPDATE vendor_verification_applications 
SET status = 'PENDING_REVIEW' 
WHERE status = 'UNDER_REVIEW';

UPDATE vendor_verification_applications 
SET status = 'REJECTED' 
WHERE status = 'REVOKED';

-- Step 2: Update VerificationAction data
-- ADMIN_REVOKED -> ADMIN_REJECTED (ADMIN_REVOKED being removed from VerificationAction)
-- PAYMENT_COMPLETED -> PAYMENT_SUCCESSFUL (already correct in schema)

UPDATE verification_audit_logs 
SET action = 'ADMIN_REJECTED' 
WHERE action = 'ADMIN_REVOKED';

UPDATE verification_audit_logs 
SET action = 'PAYMENT_SUCCESSFUL' 
WHERE action = 'PAYMENT_COMPLETED';

-- Step 3: Handle enum type alterations for PostgreSQL < 17
-- PostgreSQL 17+ supports DROP VALUE directly
-- For older versions, we need to recreate the enum type

DO $$
DECLARE
    pg_version int;
BEGIN
    SELECT setting::int INTO pg_version FROM pg_settings WHERE name = 'server_version_num';
    
    IF pg_version < 170000 THEN
        -- PostgreSQL < 17: Need to recreate enum type with only desired values
        
        -- Create new VerificationStatus enum (KYC_SUBMITTED removed since it's now only an action)
        CREATE TYPE "VerificationStatus_new" AS ENUM (
            'NOT_APPLIED',
            'UNPAID',
            'PAID_PENDING_KYC',
            'PENDING_REVIEW',
            'APPROVED',
            'REJECTED',
            'CHANGES_REQUESTED'
        );
        
        -- Convert column to use new enum (values already migrated above)
        ALTER TABLE "vendor_verification_applications" 
        ALTER COLUMN status TYPE "VerificationStatus_new" 
        USING status::text::"VerificationStatus_new";
        
        -- Drop old enum
        DROP TYPE "VerificationStatus";
        
        -- Rename new enum to original name
        ALTER TYPE "VerificationStatus_new" RENAME TO "VerificationStatus";
        
        -- Create new VerificationAction enum (ADMIN_REVOKED removed)
        CREATE TYPE "VerificationAction_new" AS ENUM (
            'APPLICATION_CREATED',
            'PAYMENT_SUCCESSFUL',
            'KYC_SUBMITTED',
            'ADMIN_APPROVED',
            'ADMIN_REJECTED',
            'ADMIN_REQUESTED_CHANGES',
            'VENDOR_RESUBMITTED'
        );
        
        -- Convert column to use new enum (values already migrated above)
        ALTER TABLE "verification_audit_logs" 
        ALTER COLUMN action TYPE "VerificationAction_new" 
        USING action::text::"VerificationAction_new";
        
        -- Drop old enum
        DROP TYPE "VerificationAction";
        
        -- Rename new enum to original name
        ALTER TYPE "VerificationAction_new" RENAME TO "VerificationAction";
    END IF;
END $$;

-- Step 4: Drop old enum values for PostgreSQL 17+
DO $$
DECLARE
    pg_version int;
BEGIN
    SELECT setting::int INTO pg_version FROM pg_settings WHERE name = 'server_version_num';
    
    IF pg_version >= 170000 THEN
        -- VerificationStatus enum - drop old values
        ALTER TYPE "VerificationStatus" DROP VALUE IF EXISTS 'PAYMENT_PENDING';
        ALTER TYPE "VerificationStatus" DROP VALUE IF EXISTS 'PAYMENT_COMPLETED';
        ALTER TYPE "VerificationStatus" DROP VALUE IF EXISTS 'KYC_SUBMITTED';
        ALTER TYPE "VerificationStatus" DROP VALUE IF EXISTS 'UNDER_REVIEW';
        ALTER TYPE "VerificationStatus" DROP VALUE IF EXISTS 'REVOKED';
        
        -- VerificationAction enum - drop old value
        ALTER TYPE "VerificationAction" DROP VALUE IF EXISTS 'ADMIN_REVOKED';
    END IF;
END $$;

-- Step 5: Add verification payment tracking fields
ALTER TABLE vendor_verification_applications 
ADD COLUMN IF NOT EXISTS paymentReference VARCHAR(255),
ADD COLUMN IF NOT EXISTS paymentStatus VARCHAR(50) DEFAULT 'UNPAID',
ADD COLUMN IF NOT EXISTS paymentAmount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS paymentCompletedAt TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS paystackRef VARCHAR(255);

-- Step 6: Add additional KYC fields
ALTER TABLE vendor_verification_kyc
ADD COLUMN IF NOT EXISTS businessAddress TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS nationalIdType VARCHAR(50),
ADD COLUMN IF NOT EXISTS nationalIdNumber VARCHAR(100);

-- Step 7: Create verification_payments table for proper payment tracking
CREATE TABLE IF NOT EXISTS verification_payments (
    id VARCHAR(191) PRIMARY KEY DEFAULT gen_random_uuid(),
    applicationId VARCHAR(191) NOT NULL,
    reference VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'GHS',
    status VARCHAR(50) DEFAULT 'PENDING',
    paystackRef VARCHAR(255),
    createdAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP(3),
    CONSTRAINT verification_payments_application_fkey FOREIGN KEY (applicationId) REFERENCES vendor_verification_applications(id) ON DELETE CASCADE
);