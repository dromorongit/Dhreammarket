-- Additive-only migration: add missing support_tickets columns
-- Matches prisma/schema.prisma SupportTicket model exactly.
-- Existing rows are unaffected because all new columns are nullable
-- or have database defaults.

BEGIN;

-- conversationRef: nullable, unique, varchar(32)
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "conversationRef" VARCHAR(32) UNIQUE DEFAULT NULL;

-- guestToken: nullable, unique, varchar(64)
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "guestToken" VARCHAR(64) UNIQUE DEFAULT NULL;

-- assignedAdminId: nullable, references users(id)
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "assignedAdminId" TEXT DEFAULT NULL REFERENCES "users"("id") ON DELETE SET NULL;

-- lastMessageAt: nullable, timestamp with default now()
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- isReadByCustomer: not null, boolean default false
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "isReadByCustomer" BOOLEAN NOT NULL DEFAULT false;

-- isReadByAdmin: not null, boolean default false
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "isReadByAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Indexes matching @@index directives in schema.prisma
CREATE INDEX IF NOT EXISTS "support_tickets_conversationRef_idx" ON "support_tickets"("conversationRef");
CREATE INDEX IF NOT EXISTS "support_tickets_guestToken_idx" ON "support_tickets"("guestToken");
CREATE INDEX IF NOT EXISTS "support_tickets_assignedAdminId_idx" ON "support_tickets"("assignedAdminId");
CREATE INDEX IF NOT EXISTS "support_tickets_lastMessageAt_idx" ON "support_tickets"("lastMessageAt");

COMMIT;
