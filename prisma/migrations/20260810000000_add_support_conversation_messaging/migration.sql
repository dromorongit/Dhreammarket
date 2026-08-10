-- Additive-only migration: support conversation/messaging tables
-- This does NOT modify existing tables and will not cause data loss.

BEGIN;

-- Support conversations (extends SupportTicket)
CREATE TABLE IF NOT EXISTS "support_conversations" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
  "ticketId" TEXT NOT NULL UNIQUE REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "conversationRef" VARCHAR(32) NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '')::varchar(32),
  "guestToken" VARCHAR(64) UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '')::varchar(64),
  "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  "customerType" VARCHAR(16) NOT NULL DEFAULT 'GUEST',
  "assignedAdminId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "lastMessageAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "isReadByCustomer" BOOLEAN NOT NULL DEFAULT false,
  "isReadByAdmin" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "support_conversations_conversationRef_idx" ON "support_conversations"("conversationRef");
CREATE INDEX IF NOT EXISTS "support_conversations_guestToken_idx" ON "support_conversations"("guestToken");
CREATE INDEX IF NOT EXISTS "support_conversations_assignedAdminId_idx" ON "support_conversations"("assignedAdminId");
CREATE INDEX IF NOT EXISTS "support_conversations_lastMessageAt_idx" ON "support_conversations"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "support_conversations_status_idx" ON "support_conversations"("status");

-- Support messages
CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
  "ticketId" TEXT NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "senderType" VARCHAR(16) NOT NULL,
  "senderId" TEXT,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "support_messages_ticketId_createdAt_idx" ON "support_messages"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "support_messages_senderType_idx" ON "support_messages"("senderType");

COMMIT;
