-- AlterTable
ALTER TABLE "products" ADD COLUMN     "costPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "costPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryCost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "costPriceSnapshot" DOUBLE PRECISION;

