-- AlterEnum
-- This migration is now idempotent to handle databases that already have these types/tables
DO $$
BEGIN
    -- Create new enum type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketType') THEN
        CREATE TYPE "SupportTicketType" AS ENUM ('GENERAL', 'PAYMENT', 'ORDER', 'VENDOR', 'ACCOUNT', 'TECHNICAL', 'REPORT');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketStatus') THEN
        CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketPriority') THEN
        CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    END IF;
END $$;

-- CreateTable (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "SupportTicketType" NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "adminReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "support_tickets_userId_idx" ON "support_tickets"("userId");
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX IF NOT EXISTS "support_tickets_type_idx" ON "support_tickets"("type");

-- AddForeignKey (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'support_tickets_userId_fkey'
    ) THEN
        ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
