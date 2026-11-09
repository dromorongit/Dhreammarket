-- Change the platformFee column default from 2.5 to 1 in super_admin_settings.
--
-- This only affects the default for newly inserted rows. Existing rows are
-- intentionally left untouched: their platformFee value is unchanged.

-- AlterTable: update the column default only.
ALTER TABLE "super_admin_settings" ALTER COLUMN "platformFee" SET DEFAULT 1;
