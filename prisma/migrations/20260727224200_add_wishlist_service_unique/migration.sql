-- AlterTable
ALTER TABLE "wishlist_items" ADD COLUMN "serviceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlistId_serviceId_key" ON "wishlist_items"("wishlistId", "serviceId");

-- CreateIndex
CREATE INDEX "wishlist_items_serviceId_idx" ON "wishlist_items"("serviceId");

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
