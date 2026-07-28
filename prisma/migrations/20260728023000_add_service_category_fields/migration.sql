-- AlterTable
ALTER TABLE "service_categories" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_categories" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "service_categories" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "service_categories" ADD COLUMN "banner" TEXT;
ALTER TABLE "service_categories" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "service_categories" ADD COLUMN "metaDescription" TEXT;