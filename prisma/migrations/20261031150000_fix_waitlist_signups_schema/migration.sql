-- Align waitlist_signups with Prisma schema and task schema
ALTER TABLE "waitlist_signups" ALTER COLUMN "source" TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_signups_email_key" ON "waitlist_signups" ("email");
