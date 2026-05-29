-- CreateTable (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "product_category_assignments" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productCategoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_category_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "product_category_assignments_productId_productCategoryId_key" ON "product_category_assignments"("productId", "productCategoryId");

-- CreateIndex (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "product_category_assignments_productId_idx" ON "product_category_assignments"("productId");

-- CreateIndex (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "product_category_assignments_productCategoryId_idx" ON "product_category_assignments"("productCategoryId");

-- AddForeignKey (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'product_category_assignments_productId_fkey'
    ) THEN
        ALTER TABLE "product_category_assignments" ADD CONSTRAINT "product_category_assignments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'product_category_assignments_productCategoryId_fkey'
    ) THEN
        ALTER TABLE "product_category_assignments" ADD CONSTRAINT "product_category_assignments_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;