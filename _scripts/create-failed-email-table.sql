CREATE TABLE IF NOT EXISTS "failed_emails" (
  "id" VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recipient_email" VARCHAR(255) NOT NULL,
  "email_type" VARCHAR(255) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "error_message" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(255) NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_attempt_at" TIMESTAMP,
  "resolved_at" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_failed_emails_status ON "failed_emails" ("status");
CREATE INDEX IF NOT EXISTS idx_failed_emails_created_at ON "failed_emails" ("created_at");
