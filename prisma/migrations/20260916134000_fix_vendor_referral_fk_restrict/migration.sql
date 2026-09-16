-- Drop existing foreign key constraints
ALTER TABLE "vendor_referrals" DROP CONSTRAINT IF EXISTS "vendor_referrals_vendorUserId_fkey";
ALTER TABLE "vendor_referrals" DROP CONSTRAINT IF EXISTS "vendor_referrals_marketingOfficerId_fkey";

-- Recreate foreign key constraints with RESTRICT instead of CASCADE
ALTER TABLE "vendor_referrals" ADD CONSTRAINT "vendor_referrals_vendorUserId_fkey"
    FOREIGN KEY ("vendorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_referrals" ADD CONSTRAINT "vendor_referrals_marketingOfficerId_fkey"
    FOREIGN KEY ("marketingOfficerId") REFERENCES "marketing_officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
