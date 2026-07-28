-- Enable service offering for all existing stores
-- This is a data-only migration (no schema changes)
UPDATE "stores" SET can_offer_services = true WHERE can_offer_services = false OR can_offer_services IS NULL;
