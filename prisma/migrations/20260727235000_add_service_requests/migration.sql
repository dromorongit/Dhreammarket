-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_requests" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "storeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "preferredCompletionDate" TIMESTAMP(3),
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "quotedPrice" DECIMAL(65,30),
    "estimatedDuration" TEXT,
    "quotationNotes" TEXT,
    "quotationValidUntil" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_request_attachments" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_request_status_history" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_quotations" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "quotedPrice" DECIMAL(65,30) NOT NULL,
    "estimatedDuration" TEXT,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_requests_serviceId_idx" ON "service_requests"("serviceId");
CREATE INDEX "service_requests_customerId_idx" ON "service_requests"("customerId");
CREATE INDEX "service_requests_vendorId_idx" ON "service_requests"("vendorId");
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");
CREATE INDEX "service_requests_createdAt_idx" ON "service_requests"("createdAt");
CREATE INDEX "service_request_attachments_serviceRequestId_idx" ON "service_request_attachments"("serviceRequestId");
CREATE INDEX "service_request_status_history_serviceRequestId_idx" ON "service_request_status_history"("serviceRequestId");
CREATE INDEX "service_quotations_serviceRequestId_idx" ON "service_quotations"("serviceRequestId");
CREATE INDEX "service_quotations_vendorId_idx" ON "service_quotations"("vendorId");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_status_history" ADD CONSTRAINT "service_request_status_history_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_request_status_history" ADD CONSTRAINT "service_request_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quotations" ADD CONSTRAINT "service_quotations_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_quotations" ADD CONSTRAINT "service_quotations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add serviceRequests relation to Store
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_type = 'foreign key'
        AND constraint_name = 'service_requests_storeId_fkey'
    ) THEN
        ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;