-- Add HomepageSectionBrand model
CREATE TABLE "HomepageSectionBrand" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomepageSectionBrand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomepageSectionBrand_sectionId_brandId_key" ON "HomepageSectionBrand"("sectionId", "brandId");

-- Add foreign keys
ALTER TABLE "HomepageSectionBrand" ADD CONSTRAINT "HomepageSectionBrand_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "HomepageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomepageSectionBrand" ADD CONSTRAINT "HomepageSectionBrand_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;