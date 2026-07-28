-- Enable service offering for all existing stores
-- This is a data-only migration (no schema changes)
UPDATE "stores" SET "canOfferServices" = true WHERE "canOfferServices" = false OR "canOfferServices" IS NULL;
