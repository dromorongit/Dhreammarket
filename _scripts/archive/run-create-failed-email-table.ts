import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

async function createFailedEmailTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('Creating failed_emails table...')

    const createTableSql = `
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
    `
    await pool.query(createTableSql)
    console.log('Created failed_emails table')

    const createIndexStatus = `
      CREATE INDEX IF NOT EXISTS idx_failed_emails_status ON "failed_emails" ("status");
    `
    await pool.query(createIndexStatus)
    console.log('Created index idx_failed_emails_status')

    const createIndexCreatedAt = `
      CREATE INDEX IF NOT EXISTS idx_failed_emails_created_at ON "failed_emails" ("created_at");
    `
    await pool.query(createIndexCreatedAt)
    console.log('Created index idx_failed_emails_created_at')

    console.log('\nVerifying table structure...')
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'failed_emails'
      ORDER BY ordinal_position
    `)

    console.table(verifyResult.rows)

    console.log('\nVerifying indexes...')
    const indexResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'failed_emails'
    `)
    console.table(indexResult.rows)

    const countResult = await pool.query(`SELECT COUNT(*) FROM "failed_emails"`)
    console.log(`\nRow count in failed_emails: ${countResult.rows[0].count}`)

    console.log('\nSuccessfully created failed_emails table and indexes')
  } catch (error) {
    console.error('Error creating failed_emails table:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

createFailedEmailTable()
