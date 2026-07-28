import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

// List all columns in service_requests
const cols = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'service_requests'
  ORDER BY ordinal_position;
`);
console.log('service_requests columns:');
console.table(cols.rows);

// Check if preferredBudget exists
const hasPreferredBudget = cols.rows.some(r => r.column_name === 'preferredBudget');
console.log('Has preferredBudget:', hasPreferredBudget);

// Check if referenceNumber exists
const hasReferenceNumber = cols.rows.some(r => r.column_name === 'referenceNumber');
console.log('Has referenceNumber:', hasReferenceNumber);

// Check indexes on service_requests
const indexes = await client.query(`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'service_requests';
`);
console.log('service_requests indexes:');
console.table(indexes.rows);

// Check if quotation_attachments table exists
const tables = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'quotation_attachments';
`);
console.log('Has quotation_attachments table:', tables.rows.length > 0);

// Check quotation_attachments columns if exists
if (tables.rows.length > 0) {
  const qaCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_attachments'
    ORDER BY ordinal_position;
  `);
  console.log('quotation_attachments columns:');
  console.table(qaCols.rows);

  const qaIndexes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'quotation_attachments';
  `);
  console.log('quotation_attachments indexes:');
  console.table(qaIndexes.rows);

  const qaFks = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'quotation_attachments'::regclass AND contype = 'f';
  `);
  console.log('quotation_attachments foreign keys:');
  console.table(qaFks.rows);
}

// Check migration history
const migrations = await client.query(`
  SELECT migration_name, finished_at, started_at
  FROM _prisma_migrations
  ORDER BY started_at;
`);
console.log('_prisma_migrations:');
console.table(migrations.rows);

// Try to find the exact failing SQL by attempting to run each statement individually
console.log('\n--- Testing migration statements ---');
const statements = [
  `ALTER TABLE "service_requests" ADD COLUMN "preferredBudget" DECIMAL(65,30);`,
  `ALTER TABLE "service_requests" ADD COLUMN "referenceNumber" VARCHAR(50);`,
  `UPDATE "service_requests" SET "referenceNumber" = 'SR-' || "id" WHERE "referenceNumber" IS NULL;`,
  `ALTER TABLE "service_requests" ALTER COLUMN "referenceNumber" SET NOT NULL;`,
  `CREATE UNIQUE INDEX "service_requests_referenceNumber_key" ON "service_requests"("referenceNumber");`,
  `CREATE TABLE "quotation_attachments" (
      "id" TEXT NOT NULL,
      "quotationId" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "fileUrl" TEXT NOT NULL,
      "fileType" TEXT NOT NULL,
      "fileSize" INTEGER NOT NULL,
      "uploadedBy" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "quotation_attachments_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE INDEX "quotation_attachments_quotationId_idx" ON "quotation_attachments"("quotationId");`,
  `ALTER TABLE "quotation_attachments" ADD CONSTRAINT "quotation_attachments_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "service_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "quotation_attachments" ADD CONSTRAINT "quotation_attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`
];

for (const sql of statements) {
  try {
    await client.query(sql);
    console.log(`OK: ${sql.substring(0, 80)}...`);
  } catch (err) {
    console.log(`FAIL: ${sql.substring(0, 80)}...`);
    console.log(`Error: ${err.message}`);
    console.log(`Code: ${err.code}`);
    console.log(`Detail: ${err.detail}`);
    console.log(`Hint: ${err.hint}`);
  }
}

await client.end();
