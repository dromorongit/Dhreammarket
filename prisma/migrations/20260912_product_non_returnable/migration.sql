-- Add isReturnable column to products table
-- Default is true so existing products remain returnable unless explicitly marked otherwise

ALTER TABLE "products" ADD COLUMN "isReturnable" BOOLEAN NOT NULL DEFAULT true;
