-- CreateTable for HomepageSection
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

-- CreateIndex for unique slug
CREATE UNIQUE INDEX IF NOT EXISTS "homepage_sections_slug_key" ON "homepage_sections"("slug");

-- CreateTable for HomepageSectionProduct
CREATE TABLE IF NOT EXISTS "homepage_section_products" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_section_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for unique section/product combination
CREATE UNIQUE INDEX IF NOT EXISTS "homepage_section_products_sectionId_productId_key" ON "homepage_section_products"("sectionId", "productId");

-- CreateIndex for queries by section
CREATE INDEX IF NOT EXISTS "homepage_section_products_sectionId_idx" ON "homepage_section_products"("sectionId");

-- CreateIndex for queries by product
CREATE INDEX IF NOT EXISTS "homepage_section_products_productId_idx" ON "homepage_section_products"("productId");

-- CreateTable for HomepageSectionVendor
CREATE TABLE IF NOT EXISTS "homepage_section_vendors" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_section_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for unique section/vendor combination
CREATE UNIQUE INDEX IF NOT EXISTS "homepage_section_vendors_sectionId_vendorId_key" ON "homepage_section_vendors"("sectionId", "vendorId");

-- CreateIndex for queries by section
CREATE INDEX IF NOT EXISTS "homepage_section_vendors_sectionId_idx" ON "homepage_section_vendors"("sectionId");

-- CreateIndex for queries by vendor
CREATE INDEX IF NOT EXISTS "homepage_section_vendors_vendorId_idx" ON "homepage_section_vendors"("vendorId");

-- AddForeignKey for homepage_section_products -> homepage_sections
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_products_sectionId_fkey'
    ) THEN
        ALTER TABLE "homepage_section_products" ADD CONSTRAINT "homepage_section_products_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "homepage_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey for homepage_section_products -> products
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_products_productId_fkey'
    ) THEN
        ALTER TABLE "homepage_section_products" ADD CONSTRAINT "homepage_section_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey for homepage_section_vendors -> homepage_sections
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_vendors_sectionId_fkey'
    ) THEN
        ALTER TABLE "homepage_section_vendors" ADD CONSTRAINT "homepage_section_vendors_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "homepage_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey for homepage_section_vendors -> users (vendors)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_vendors_vendorId_fkey'
    ) THEN
        ALTER TABLE "homepage_section_vendors" ADD CONSTRAINT "homepage_section_vendors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;