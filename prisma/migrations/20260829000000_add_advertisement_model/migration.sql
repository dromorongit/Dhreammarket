-- CreateTable
CREATE TABLE "advertisements" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT NOT NULL,
    "vendorId" TEXT,
    "productId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "advertisements_slot_isActive_startDate_endDate_idx" ON "advertisements"("slot", "isActive", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
