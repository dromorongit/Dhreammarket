-- Add additional indexes and foreign keys for homepage section tables if already created
-- Note: Tables are created in migration 20260530000001, this just adds FK constraints if missing

-- AddForeignKey for homepage_section_products -> homepage_sections
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_products_sectionId_fkey'
    ) THEN
        ALTER TABLE IF EXISTS "homepage_section_products" ADD CONSTRAINT "homepage_section_products_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "homepage_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey for homepage_section_products -> products
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_products_productId_fkey'
    ) THEN
        ALTER TABLE IF EXISTS "homepage_section_products" ADD CONSTRAINT "homepage_section_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey for homepage_section_vendors -> homepage_sections
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_vendors_sectionId_fkey'
    ) THEN
        ALTER TABLE IF EXISTS "homepage_section_vendors" ADD CONSTRAINT "homepage_section_vendors_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "homepage_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey for homepage_section_vendors -> users (vendors)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_vendors_vendorId_fkey'
    ) THEN
        ALTER TABLE IF EXISTS "homepage_section_vendors" ADD CONSTRAINT "homepage_section_vendors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Additional indexes for homepage_section_products if missing
CREATE INDEX IF NOT EXISTS "homepage_section_products_sectionId_idx" ON "homepage_section_products"("sectionId");
CREATE INDEX IF NOT EXISTS "homepage_section_products_productId_idx" ON "homepage_section_products"("productId");