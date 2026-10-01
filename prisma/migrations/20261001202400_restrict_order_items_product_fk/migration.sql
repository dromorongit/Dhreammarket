ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_productId_fkey";
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
