-- Add isActive column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;

-- Update existing categories to have isActive = true (in case there are any)
UPDATE categories SET "isActive" = true WHERE "isActive" IS NULL;

-- Make isActive NOT NULL after populating
ALTER TABLE categories ALTER COLUMN "isActive" SET NOT NULL;
