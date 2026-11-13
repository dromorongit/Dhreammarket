-- Support AI v2: support feedback store.
-- Additive-only migration: creates a new table only.
BEGIN;

CREATE TABLE IF NOT EXISTS "support_feedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "traceId" TEXT NOT NULL,
  "helpful" BOOLEAN NOT NULL,
  "reason" TEXT,
  "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "support_feedback_conversationId_idx" ON "support_feedback"("conversationId");
CREATE INDEX IF NOT EXISTS "support_feedback_traceId_idx" ON "support_feedback"("traceId");

COMMIT;
