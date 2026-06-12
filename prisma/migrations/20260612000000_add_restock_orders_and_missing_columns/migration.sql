-- Create enum types for supplier and purchase order models
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupplierStatus') THEN
        CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISABLED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupplierDocumentType') THEN
        CREATE TYPE "SupplierDocumentType" AS ENUM ('CONTRACT', 'INVOICE', 'QUOTATION', 'AGREEMENT');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseOrderStatus') THEN
        CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'SHIPPED', 'ARRIVED', 'RECEIVED', 'CANCELLED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RestockOrderStatus') THEN
        CREATE TYPE "RestockOrderStatus" AS ENUM ('ORDERED', 'SHIPPED', 'ARRIVED', 'RECEIVED', 'CANCELLED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductAvailabilityType') THEN
        CREATE TYPE "ProductAvailabilityType" AS ENUM ('IN_STOCK', 'PREORDER', 'BACKORDER');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderFulfillmentStatus') THEN
        CREATE TYPE "OrderFulfillmentStatus" AS ENUM ('PENDING', 'AWAITING_STOCK', 'AWAITING_RESTOCK', 'READY_TO_FULFILL', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderType') THEN
        CREATE TYPE "OrderType" AS ENUM ('NORMAL', 'PREORDER', 'BACKORDER');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
        CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
        CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');
    END IF;
END $$;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poNumber" TEXT,
    "expectedArrivalDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "actualArrivalDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- Create supplier_documents table
CREATE TABLE IF NOT EXISTS "supplier_documents" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "documentType" "SupplierDocumentType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("id")
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- Create fulfillment_events table
CREATE TABLE IF NOT EXISTS "fulfillment_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "fulfillment_events_pkey" PRIMARY KEY ("id")
);

-- Create restock_orders table (missing from production)
CREATE TABLE IF NOT EXISTS "restock_orders" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL DEFAULT 0,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "status" "RestockOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "expectedArrivalDate" TIMESTAMP(3),
    "actualArrivalDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "purchaseOrderId" TEXT,

    CONSTRAINT "restock_orders_pkey" PRIMARY KEY ("id")
);

-- Add reservedQuantity column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

-- Add lowStockThreshold column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

-- Add flashSalePrice column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flashSalePrice" DOUBLE PRECISION;

-- Add flashSaleStart column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flashSaleStart" TIMESTAMP(3);

-- Add flashSaleEnd column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flashSaleEnd" TIMESTAMP(3);

-- Add salesCount column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "salesCount" INTEGER NOT NULL DEFAULT 0;

-- Add isSponsored column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isSponsored" BOOLEAN NOT NULL DEFAULT false;

-- Add dealsPrice column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "dealsPrice" DOUBLE PRECISION;

-- Add salesPrice column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "salesPrice" DOUBLE PRECISION;

-- Add availabilityType column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "availabilityType" "ProductAvailabilityType" NOT NULL DEFAULT 'IN_STOCK';

-- Add expectedArrivalDate column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "expectedArrivalDate" TIMESTAMP(3);

-- Add estimatedFulfillmentDays column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "estimatedFulfillmentDays" INTEGER;

-- Add preOrderNotes column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "preOrderNotes" TEXT;

-- Add expectedRestockDate column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "expectedRestockDate" TIMESTAMP(3);

-- Add backOrderNotes column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "backOrderNotes" TEXT;

-- Add reservedQuantity column to product_variants table
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

-- Add inventoryConsumedAt column to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inventoryConsumedAt" TIMESTAMP(3);

-- Add allocatedAt column to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "allocatedAt" TIMESTAMP(3);

-- Add orderType column to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "orderType" "OrderType" NOT NULL DEFAULT 'NORMAL';

-- Add fulfillmentStatus column to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillmentStatus" "OrderFulfillmentStatus" NOT NULL DEFAULT 'PENDING';

-- Add allocatedQuantity column to order_items table
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "allocatedQuantity" INTEGER NOT NULL DEFAULT 0;

-- Add availabilityType column to order_items table
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "availabilityType" "ProductAvailabilityType";

-- Add expectedArrivalDate column to order_items table
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "expectedArrivalDate" TIMESTAMP(3);

-- Add expectedRestockDate column to order_items table
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "expectedRestockDate" TIMESTAMP(3);

-- Create indexes for suppliers
CREATE INDEX IF NOT EXISTS "suppliers_id_idx" ON "suppliers"("id");

-- Create indexes for purchase_orders
CREATE INDEX IF NOT EXISTS "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");
CREATE INDEX IF NOT EXISTS "purchase_orders_vendorId_idx" ON "purchase_orders"("vendorId");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE INDEX IF NOT EXISTS "purchase_orders_createdAt_idx" ON "purchase_orders"("createdAt");

-- Create indexes for supplier_documents
CREATE INDEX IF NOT EXISTS "supplier_documents_supplierId_idx" ON "supplier_documents"("supplierId");
CREATE INDEX IF NOT EXISTS "supplier_documents_documentType_idx" ON "supplier_documents"("documentType");

-- Create indexes for purchase_order_items
CREATE INDEX IF NOT EXISTS "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");

-- Create indexes for fulfillment_events
CREATE INDEX IF NOT EXISTS "fulfillment_events_orderId_idx" ON "fulfillment_events"("orderId");
CREATE INDEX IF NOT EXISTS "fulfillment_events_eventType_idx" ON "fulfillment_events"("eventType");
CREATE INDEX IF NOT EXISTS "fulfillment_events_createdAt_idx" ON "fulfillment_events"("createdAt");

-- Create indexes for restock_orders
CREATE INDEX IF NOT EXISTS "restock_orders_vendorId_idx" ON "restock_orders"("vendorId");
CREATE INDEX IF NOT EXISTS "restock_orders_productId_idx" ON "restock_orders"("productId");
CREATE INDEX IF NOT EXISTS "restock_orders_status_idx" ON "restock_orders"("status");

-- Add foreign key constraints for restock_orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'restock_orders_productId_fkey'
    ) THEN
        ALTER TABLE "restock_orders" ADD CONSTRAINT "restock_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'restock_orders_vendorId_fkey'
    ) THEN
        ALTER TABLE "restock_orders" ADD CONSTRAINT "restock_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE RESTRICT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'restock_orders_purchaseOrderId_fkey'
    ) THEN
        ALTER TABLE "restock_orders" ADD CONSTRAINT "restock_orders_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key constraints for purchase_orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'purchase_orders_supplierId_fkey'
    ) THEN
        ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'purchase_orders_vendorId_fkey'
    ) THEN
        ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- Add foreign key constraints for supplier_documents
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'supplier_documents_supplierId_fkey'
    ) THEN
        ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraints for purchase_order_items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'purchase_order_items_purchaseOrderId_fkey'
    ) THEN
        ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'purchase_order_items_productId_fkey'
    ) THEN
        ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- Add foreign key constraints for fulfillment_events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fulfillment_events_orderId_fkey'
    ) THEN
        ALTER TABLE "fulfillment_events" ADD CONSTRAINT "fulfillment_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE;
    END IF;
END $$;