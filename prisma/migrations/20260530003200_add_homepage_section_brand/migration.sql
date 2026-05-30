-- Add HomepageSectionBrand model
CREATE TABLE IF NOT EXISTS "homepage_section_brands" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_section_brands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "homepage_section_brands_sectionId_brandId_key" ON "homepage_section_brands"("sectionId", "brandId");

-- Add foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_brands_sectionId_fkey'
    ) THEN
        ALTER TABLE "homepage_section_brands" ADD CONSTRAINT "homepage_section_brands_sectionId_fkey"
            FOREIGN KEY ("sectionId") REFERENCES "homepage_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'homepage_section_brands_brandId_fkey'
    ) THEN
        ALTER TABLE "homepage_section_brands" ADD CONSTRAINT "homepage_section_brands_brandId_fkey"
            FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;