-- AlterTable
ALTER TABLE "stores" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stores" ADD COLUMN "featuredUntil" TIMESTAMP(3);
ALTER TABLE "stores" ADD COLUMN "logo" TEXT;
ALTER TABLE "stores" ADD COLUMN "banner" TEXT;