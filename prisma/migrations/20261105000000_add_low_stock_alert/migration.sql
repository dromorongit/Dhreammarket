-- Add low-stock alert support: Product.lowStockAlertedAt column and the
-- NotificationType.LOW_STOCK enum value.
--
-- LOW_STOCK is added with ALTER TYPE ... ADD VALUE and is intentionally not
-- referenced (no notifications of this type are created) in this migration.

-- AlterTable: add nullable lowStockAlertedAt to products.
ALTER TABLE "products" ADD COLUMN "lowStockAlertedAt" TIMESTAMP(3);

-- AlterTable: append LOW_STOCK to the NotificationType enum.
ALTER TYPE "NotificationType" ADD VALUE 'LOW_STOCK';
