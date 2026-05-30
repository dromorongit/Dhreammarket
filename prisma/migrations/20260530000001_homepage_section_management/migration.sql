-- Brand management for homepage Brand Store
CREATE TABLE IF NOT EXISTS "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "brands_name_key" ON "brands"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "brands_slug_key" ON "brands"("slug");

-- Optional brand FK on products (preserves existing brand string column)
ALTER TABLE IF EXISTS "products" ADD COLUMN IF NOT EXISTS "brandId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_brandId_fkey'
    ) THEN
        ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey"
            FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Product display order within homepage sections (create table if needed for idempotency)
CREATE TABLE IF NOT EXISTS "homepage_sections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'PRODUCT_GRID',
    "subtitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "homepage_sections_slug_key" ON "homepage_sections"("slug");

CREATE TABLE IF NOT EXISTS "homepage_section_products" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_section_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "homepage_section_products_sectionId_productId_key" ON "homepage_section_products"("sectionId", "productId");

-- Create HomepageSectionVendor table
CREATE TABLE IF NOT EXISTS "homepage_section_vendors" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_section_vendors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "homepage_section_vendors_sectionId_vendorId_key" ON "homepage_section_vendors"("sectionId", "vendorId");
CREATE INDEX IF NOT EXISTS "homepage_section_vendors_sectionId_idx" ON "homepage_section_vendors"("sectionId");
CREATE INDEX IF NOT EXISTS "homepage_section_vendors_vendorId_idx" ON "homepage_section_vendors"("vendorId");

-- Add displayOrder column if table already exists without it
ALTER TABLE "homepage_section_products" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;
