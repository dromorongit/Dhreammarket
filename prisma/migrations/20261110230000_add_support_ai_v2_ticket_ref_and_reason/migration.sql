-- Support AI v2 pilot: store v2 conversation reference and escalation reason on tickets.
-- Additive-only migration: adds nullable columns to support_tickets.
BEGIN;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "conversationRef" VARCHAR(32);
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "escalationReason" TEXT;

CREATE INDEX IF NOT EXISTS "support_tickets_conversationRef_idx" ON "support_tickets"("conversationRef");

COMMIT;
