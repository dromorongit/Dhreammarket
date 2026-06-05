-- Add verification payment tracking fields
ALTER TABLE vendor_verification_applications 
ADD COLUMN IF NOT EXISTS paymentReference VARCHAR(255),
ADD COLUMN IF NOT EXISTS paymentStatus VARCHAR(50) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS paymentAmount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS paymentCompletedAt TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS paystackRef VARCHAR(255);

-- Add additional KYC fields
ALTER TABLE vendor_verification_kyc
ADD COLUMN IF NOT EXISTS businessAddress TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS nationalIdType VARCHAR(50),
ADD COLUMN IF NOT EXISTS nationalIdNumber VARCHAR(100);

-- Create verification_payments table for proper payment tracking
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