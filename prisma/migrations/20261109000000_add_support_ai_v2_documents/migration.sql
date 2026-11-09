-- Support AI v2: approved document store with Postgres full-text search.
-- Additive-only migration: creates new tables and a new column only.
-- Note: `contentSearch` (tsvector) is added by raw SQL here because Prisma
-- has no tsvector type; it is intentionally absent from schema.prisma.
BEGIN;

CREATE TABLE IF NOT EXISTS "support_documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "intent" TEXT NOT NULL,
  "authorId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewerId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "approvedAt" TIMESTAMP(3),
  "reviewDueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "support_documents_intent_status_idx" ON "support_documents"("intent", "status");
-- Exactly one active (APPROVED/PUBLISHED) version per intent.
CREATE UNIQUE INDEX IF NOT EXISTS "support_documents_one_active_version_per_intent" ON "support_documents"("intent") WHERE "status" IN ('APPROVED', 'PUBLISHED');

CREATE TABLE IF NOT EXISTS "document_chunks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES "support_documents"("id") ON DELETE CASCADE,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "contentSearch" TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_chunks_documentId_chunkIndex_key" ON "document_chunks"("documentId", "chunkIndex");
CREATE INDEX IF NOT EXISTS "document_chunks_documentId_idx" ON "document_chunks"("documentId");
CREATE INDEX IF NOT EXISTS "document_chunks_contentSearch_idx" ON "document_chunks" USING GIN ("contentSearch");

ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "supportAiV2Enabled" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
